import React, { useEffect } from 'react';
import { useIPC, useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../../utils/billing-math';

interface BillSummary {
  id: number;
  billNumber: string;
  customerId: number | null;
  grandTotal: number; // in paise
  paymentMode: string;
  createdAt: string;
}

interface BillHistoryModalProps {
  onClose: () => void;
  printerName: string;
}

export const BillHistoryModal: React.FC<BillHistoryModalProps> = ({ onClose, printerName }) => {
  // Fetch Today's Bills
  const { 
    data: bills, 
    loading, 
    error,
    execute: refreshBills 
  } = useIPC<BillSummary[]>(IPC_CHANNELS.BILL_TODAY);

  // Reprint Mutation
  const {
    execute: reprintBill,
    loading: reprinting
  } = useIPCMutation<{ billId: number; printerName: string }, boolean>(IPC_CHANNELS.BILL_PRINT);

  // Initial Load
  useEffect(() => {
    refreshBills();
  }, [refreshBills]);

  // Keyboard Support (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to BillingPage
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleReprint = async (billId: number) => {
    try {
      await reprintBill({ billId, printerName });
      // Optional: Show toast
    } catch (err) {
      alert('Reprint failed. Check printer connection.');
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        width: '800px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div className="modal-header" style={{
          padding: '1rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Today's Sales</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >&times;</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{
          padding: '1rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {loading && <div className="text-center p-4">Loading history...</div>}
          
          {error && <div className="error-message p-4 text-red-600">Error loading history: {error}</div>}
          
          {!loading && !error && (!bills || bills.length === 0) && (
            <div className="text-center p-8 text-gray-500">
              No sales recorded today.
            </div>
          )}

          {!loading && bills && bills.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '0.75rem' }}>Time</th>
                  <th style={{ padding: '0.75rem' }}>Bill No</th>
                  <th style={{ padding: '0.75rem' }}>Mode</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => (
                  <tr key={bill.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem' }}>
                      {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{bill.billNumber}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.1rem 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.85rem',
                        background: bill.paymentMode === 'cash' ? '#dbeafe' : '#f3e8ff',
                        color: bill.paymentMode === 'cash' ? '#1e40af' : '#6b21a8',
                        textTransform: 'capitalize'
                      }}>
                        {bill.paymentMode}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                      ₹{formatCurrency(bill.grandTotal)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleReprint(bill.id)}
                        disabled={reprinting}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          color: '#374151'
                        }}
                      >
                        {reprinting ? '...' : 'Reprint'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{
          padding: '1rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
