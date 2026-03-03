import React, { useState, useEffect } from 'react';
import { useIPC } from '@renderer/hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { PurchaseOrder } from '@shared/types/ipc';
import { formatCurrency } from '@renderer/utils/formatters';
import PurchaseOrderFormModal from './PurchaseOrderFormModal';
import EmptyState from '../common/EmptyState';

export default function PurchaseOrdersTab({
  dateRange,
  refreshKey,
  onCreateClick,
  onReceive,
}: {
  dateRange?: { startDate: string; endDate: string };
  refreshKey?: number;
  onCreateClick?: () => void;
  onReceive?: (po: PurchaseOrder) => void;
}) {
  const [editingPoId, setEditingPoId] = useState<number | null>(null);
  const {
    data: posResult,
    loading,
    execute: fetchPOs,
  } = useIPC<{ data: PurchaseOrder[]; total: number }>(IPC_CHANNELS.PO_LIST);

  useEffect(() => {
    fetchPOs(dateRange);
  }, [fetchPOs, dateRange, refreshKey]);

  const pos = posResult?.data || [];

  return (
    <>
      {loading ? (
        <div className="loading-state">Loading purchase orders...</div>
      ) : pos.length === 0 ? (
        <EmptyState
          title="No Pending Orders"
          message="Create a purchase order to request stock from your suppliers."
          icon="📝"
          action={
            onCreateClick
              ? {
                  label: 'Create First PO',
                  onClick: onCreateClick,
                }
              : undefined
          }
        />
      ) : (
        <div className="data-table-container">
          <div className="data-table-header grid-orders">
            <div className="col-date">Date</div>
            <div className="col-po-no">PO #</div>
            <div className="col-supplier">Supplier</div>
            <div className="col-grand-total">Grand Total</div>
            <div className="col-status">Status</div>
            <div className="col-actions">Actions</div>
          </div>
          <div className="data-table-body">
            {pos.map((p) => (
              <div className="data-table-row grid-orders" key={p.id}>
                <div className="col-date">{new Date(p.poDate).toLocaleDateString('en-IN')}</div>
                <div className="col-po-no font-mono">{p.poNumber}</div>
                <div className="col-supplier">
                  <div className="supplier-info">
                    <span className="name">{p.supplierName}</span>
                  </div>
                </div>
                <div className="col-grand-total">{formatCurrency(p.grandTotal)}</div>
                <div>
                  <span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span>
                </div>
                <div className="col-actions">
                  {p.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="action-icon-btn action-edit"
                        title="Edit Order"
                        onClick={() => setEditingPoId(p.id)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        className="action-icon-btn action-settle"
                        title="Mark Received"
                        onClick={() => onReceive && onReceive(p)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m3 9 9 7 9-7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {editingPoId !== null && (
        <PurchaseOrderFormModal
          initialPoId={editingPoId}
          onClose={() => setEditingPoId(null)}
          onSuccess={() => {
            setEditingPoId(null);
            fetchPOs(dateRange);
          }}
        />
      )}
    </>
  );
}
