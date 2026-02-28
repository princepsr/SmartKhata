import React, { useState, useEffect, useMemo } from 'react';
import { useIPC, useIPCMutation } from '@renderer/hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PurchaseOrder } from '@shared/types/ipc';
import { formatCurrency } from '@renderer/utils/formatters';
import PurchaseOrderFormModal from '@renderer/components/purchases/PurchaseOrderFormModal';

export default function PurchaseOrdersTab() {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [viewingPoId, setViewingPoId] = useState<number | null>(null);

  const {
    data: posResult,
    loading,
    error,
    execute: fetchPOs,
  } = useIPC<{ data: PurchaseOrder[]; total: number }>(IPC_CHANNELS.PO_LIST);

  const { execute: convertToPurchase, loading: converting } = useIPCMutation(
    IPC_CHANNELS.PO_CONVERT
  );

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  const handleConvert = async (id: number) => {
    if (
      window.confirm(
        'Are you sure you want to convert this PO to a Purchase? This action marks the order as received.'
      )
    ) {
      const res = await convertToPurchase(id);
      if (res) {
        alert('PO marked as Received! (Stock update feature coming soon)');
        fetchPOs();
      }
    }
  };

  const pos = posResult?.data || [];

  return (
    <div
      className="purchases-content"
      style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
    >
      <div
        style={{
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Purchase Orders</h2>
        <button className="btn-primary" onClick={() => setIsAddingNew(true)}>
          + Create Purchase Order
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading purchase orders...</div>
      ) : pos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No Pending Orders</h3>
          <p>Create a purchase order to request stock from your suppliers.</p>
          <button className="btn-secondary" onClick={() => setIsAddingNew(true)}>
            Create First PO
          </button>
        </div>
      ) : (
        <div className="data-table-container">
          <div
            className="data-table-header"
            style={{ gridTemplateColumns: '1.2fr 1.5fr 2.5fr 1.5fr 1fr 1fr' }}
          >
            <div className="col-date">Date</div>
            <div className="col-po-no">PO #</div>
            <div className="col-supplier">Supplier</div>
            <div className="col-grand-total text-right">Grand Total</div>
            <div className="col-status text-center">Status</div>
            <div className="col-actions text-center">Actions</div>
          </div>

          {pos.map((p) => (
            <div
              className="data-table-row"
              key={p.id}
              style={{ gridTemplateColumns: '1.2fr 1.5fr 2.5fr 1.5fr 1fr 1fr' }}
            >
              <div className="col-date">{new Date(p.poDate).toLocaleDateString('en-IN')}</div>
              <div className="font-mono text-muted">{p.poNumber}</div>
              <div className="col-supplier">
                <span className="name" style={{ fontWeight: 600 }}>
                  {p.supplierName}
                </span>
              </div>
              <div className="col-grand-total text-right font-bold">
                {formatCurrency(p.grandTotal)}
              </div>
              <div className="col-status text-center">
                <span
                  className={`status-badge ${p.status.toLowerCase()}`}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor:
                      p.status === 'PENDING'
                        ? '#fff3cd'
                        : p.status === 'RECEIVED'
                          ? '#d4edda'
                          : '#f8d7da',
                    color:
                      p.status === 'PENDING'
                        ? '#856404'
                        : p.status === 'RECEIVED'
                          ? '#155724'
                          : '#721c24',
                  }}
                >
                  {p.status}
                </span>
              </div>
              <div className="col-actions" style={{ justifyContent: 'center' }}>
                {p.status === 'PENDING' && (
                  <button
                    className="btn-outline"
                    title="Mark Received"
                    onClick={() => handleConvert(p.id)}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', marginRight: '0.5rem' }}
                    disabled={converting}
                  >
                    Receive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddingNew && (
        <PurchaseOrderFormModal
          onClose={() => setIsAddingNew(false)}
          onSuccess={() => {
            setIsAddingNew(false);
            fetchPOs();
          }}
        />
      )}
    </div>
  );
}
