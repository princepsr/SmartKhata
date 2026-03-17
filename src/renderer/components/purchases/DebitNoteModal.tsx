import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/formatters';
import { useConfirm } from '../../hooks/useConfirm';
import { Purchase, PurchaseItem, RecordReturnInput, DebitNote } from '@shared/types/ipc';
import './DebitNoteModal.css';

interface DebitNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase;
  items: PurchaseItem[];
  onSuccess: () => void;
}

interface ReturnItemState {
  purchaseItemId: number;
  productId: number;
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  gstPercent: number;
  returnedQuantity: number;
}

export const DebitNoteModal: React.FC<DebitNoteModalProps> = ({
  isOpen,
  onClose,
  purchase,
  items,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('PURCHASE_RETURN');
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
  const {
    execute: createDebitNote,
    loading,
    error,
  } = useIPCMutation<RecordReturnInput, DebitNote>(IPC_CHANNELS.DEBIT_NOTE_CREATE);
  const { alert } = useConfirm();

  useEffect(() => {
    if (isOpen) {
      setReturnItems(
        items.map((item) => ({
          purchaseItemId: item.id,
          productId: item.productId || 0,
          productName: item.productName,
          originalQty: item.quantity,
          returnQty: 0,
          unitPrice: item.unitPrice,
          gstPercent: item.gstPercent,
          returnedQuantity: item.returnedQuantity,
        }))
      );
    }
  }, [isOpen, items]);

  if (!isOpen) {
    return null;
  }

  const handleReturnQtyChange = (purchaseItemId: number, qty: number, availableQty: number) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.purchaseItemId === purchaseItemId
          ? { ...item, returnQty: Math.max(0, Math.min(qty, availableQty)) }
          : item
      )
    );
  };

  const calculateTotal = () => {
    return returnItems.reduce(
      (acc, item) => {
        const lineTaxable = item.unitPrice * item.returnQty;
        const lineGst = (lineTaxable * item.gstPercent) / 100;
        return {
          taxable: acc.taxable + lineTaxable,
          gst: acc.gst + lineGst,
          total: acc.total + lineTaxable + lineGst,
        };
      },
      { taxable: 0, gst: 0, total: 0 }
    );
  };

  const totals = calculateTotal();

  const handleSubmit = async () => {
    const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);
    if (itemsToReturn.length === 0) {
      await alert({
        title: t('common.selection_required'),
        message: t('procurement.form.errors.product_req'),
        type: 'warning',
      });
      return;
    }

    try {
      const response = await createDebitNote({
        purchaseId: purchase.id,
        supplierId: purchase.supplierId || 0,
        reason,
        items: itemsToReturn.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.returnQty,
          unitPrice: i.unitPrice,
          gstPercent: i.gstPercent,
        })),
      });

      if (response) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create debit note:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content debit-note-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('procurement.debit_note_title')}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="debit-note-scroll-area">
            <div className="purchase-meta-info">
              <div>
                <span className="label text-muted">{t('procurement.purchases.table.p_no')}:</span>
                <span className="value font-mono">{purchase.purchaseNumber}</span>
              </div>
              <div>
                <span className="label text-muted">{t('procurement.purchases.table.supplier')}:</span>
                <span className="value">{purchase.supplierName}</span>
              </div>
            </div>

            <table className="items-table">
              <thead>
                <tr>
                  <th>{t('procurement.details.product')}</th>
                  <th className="text-right">{t('procurement.details.qty')}</th>
                  <th className="text-right">{t('procurement.details.returned') || 'Returned'}</th>
                  <th className="text-center" style={{ width: '120px' }}>
                    {t('procurement.form.qty_label')}
                  </th>
                  <th className="text-right">{t('procurement.details.rate')}</th>
                  <th className="text-right">{t('procurement.form.total_label')}</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item) => (
                  <tr key={item.purchaseItemId}>
                    <td>{item.productName}</td>
                    <td className="text-right">{item.originalQty}</td>
                    <td className="text-right">{item.returnedQuantity}</td>
                    <td className="text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.originalQty - item.returnedQuantity}
                        value={item.returnQty}
                        onChange={(e) =>
                          handleReturnQtyChange(
                            item.purchaseItemId,
                            Number(e.target.value),
                            item.originalQty - item.returnedQuantity
                          )
                        }
                        className="qty-input"
                        disabled={item.originalQty - item.returnedQuantity <= 0}
                      />
                    </td>
                    <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right">
                      {formatCurrency(item.returnQty * item.unitPrice * (1 + item.gstPercent / 100))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="dn-form-fields">
              <div className="form-group">
                <label>{t('procurement.form.notes')}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('procurement.form.notes_placeholder')}
                />
              </div>
            </div>

            <div className="dn-summary-section">
              <div className="summary-card">
                <div className="summary-row">
                  <span>{t('procurement.form.taxable_amt')}</span>
                  <span>{formatCurrency(totals.taxable)}</span>
                </div>
                <div className="summary-row">
                  <span>{t('procurement.form.gst_amt')}</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="summary-row grand-total">
                  <span>{t('procurement.form.grand_total')}</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-danger-primary"
            onClick={handleSubmit}
            disabled={loading || totals.total <= 0}
          >
            {loading ? t('procurement.form.saving') : t('procurement.issue_debit_note')}
          </button>
        </div>
      </div>
    </div>
  );
};
