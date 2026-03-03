import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { Supplier } from '@shared/types/ipc';
import EmptyState from '../components/common/EmptyState';
import { SupplierLedgerModal } from '../components/purchases/SupplierLedgerModal';
import { SupplierSettleBalanceModal } from '../components/purchases/SupplierSettleBalanceModal';
import { ConfirmModal } from '../components/ConfirmModal';
import './SuppliersPage.css';

export interface SuppliersPageHandle {
  handleCreateNew: () => void;
}

export interface SuppliersPageProps {
  showHeader?: boolean;
  searchQuery?: string;
  showInactive?: boolean;
  showDuesOnly?: boolean;
}

const SuppliersPage = forwardRef<SuppliersPageHandle, SuppliersPageProps>(
  (
    {
      showHeader = true,
      searchQuery: externalSearchQuery,
      showInactive: externalShowInactive,
      showDuesOnly: externalShowDuesOnly,
    },
    ref
  ) => {
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
    const [settleSupplier, setSettleSupplier] = useState<Supplier | null>(null);

    const [confirmDialog, setConfirmDialog] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
    }>({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: () => {},
    });

    const [internalShowInactive, setInternalShowInactive] = useLocalStorage(
      'suppliers_show_inactive',
      false
    );
    const [internalShowDuesOnly, setInternalShowDuesOnly] = useLocalStorage(
      'suppliers_show_dues_only',
      false
    );

    const searchQuery =
      externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
    const showInactive =
      externalShowInactive !== undefined ? externalShowInactive : internalShowInactive;
    const showDuesOnly =
      externalShowDuesOnly !== undefined ? externalShowDuesOnly : internalShowDuesOnly;

    const {
      data,
      loading,
      error,
      execute: fetchSuppliers,
    } = useIPC<{ items: Supplier[] }>(IPC_CHANNELS.SUPPLIER_LIST);

    const { execute: toggleStatus } = useIPC(IPC_CHANNELS.SUPPLIER_TOGGLE_STATUS);

    useEffect(() => {
      fetchSuppliers({ includeInactive: showInactive });
    }, [fetchSuppliers, showInactive]);

    const suppliers = useMemo(() => data?.items || [], [data]);

    const filteredSuppliers = useMemo(() => {
      let result = suppliers;

      if (showDuesOnly) {
        result = result.filter((s) => s.balanceDue !== 0);
      }

      if (!searchQuery.trim()) {
        return result;
      }

      const lowerQuery = searchQuery.toLowerCase();
      return result.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          (s.phone && s.phone.includes(lowerQuery)) ||
          (s.gstin && s.gstin.toLowerCase().includes(lowerQuery))
      );
    }, [suppliers, searchQuery, showDuesOnly]);

    const handleCreateNew = () => {
      setEditingSupplier(null);
      setIsFormOpen(true);
    };

    const handleEdit = (supplier: Supplier) => {
      setEditingSupplier(supplier);
      setIsFormOpen(true);
    };

    const handleCloseForm = () => {
      setIsFormOpen(false);
      setEditingSupplier(null);
      fetchSuppliers({ includeInactive: showInactive });
    };

    const handleToggleStatus = async (supplier: Supplier, e: React.MouseEvent) => {
      e.stopPropagation();
      const isDeactivating = supplier.isActive;

      if (isDeactivating) {
        setConfirmDialog({
          isOpen: true,
          title: 'Deactivate Supplier',
          message: `Are you sure you want to deactivate "${supplier.name}"? This will hide them from the active supplier list.`,
          onConfirm: async () => {
            try {
              await toggleStatus({ id: supplier.id, isActive: false });
              fetchSuppliers({ includeInactive: showInactive });
            } catch (err) {
              console.error('Failed to toggle status:', err);
            }
          },
        });
        return;
      }

      try {
        await toggleStatus({ id: supplier.id, isActive: true });
        fetchSuppliers({ includeInactive: showInactive });
      } catch (err) {
        console.error('Failed to toggle status:', err);
      }
    };

    useImperativeHandle(ref, () => ({
      handleCreateNew,
    }));

    return (
      <div
        className={showHeader ? 'page-container suppliers-page animate-fade-in' : 'suppliers-page'}
      >
        {showHeader && (
          <header className="page-header">
            <div>
              <h1 className="page-title">Procurement & Suppliers</h1>
              <p className="page-subtitle">Manage your suppliers and purchase orders</p>
            </div>
            <div className="header-actions">
              <div className="filter-group">
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => {
                      if (externalShowInactive === undefined) {
                        setInternalShowInactive(e.target.checked);
                      }
                    }}
                  />
                  Show Inactive
                </label>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={showDuesOnly}
                    onChange={(e) => {
                      if (externalShowDuesOnly === undefined) {
                        setInternalShowDuesOnly(e.target.checked);
                      }
                    }}
                  />
                  Show Dues Only
                </label>
              </div>
              <div className="search-bar">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, phone, GSTIN..."
                  value={searchQuery}
                  onChange={(e) => {
                    if (externalSearchQuery === undefined) {
                      setInternalSearchQuery(e.target.value);
                    }
                  }}
                />
              </div>
              <button className="btn btn-primary" onClick={handleCreateNew}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Supplier
              </button>
            </div>
          </header>
        )}

        <div className={showHeader ? 'page-content' : ''}>
          {error && <div className="error-banner">{error}</div>}

          <div className="data-table-container">
            {loading ? (
              <div className="loading-state">Loading suppliers...</div>
            ) : filteredSuppliers.length === 0 ? (
              <EmptyState
                title="No Suppliers Found"
                message={
                  searchQuery
                    ? 'Try matching different keywords.'
                    : 'Add your first supplier to start taking purchases.'
                }
                icon="👥"
                action={
                  !searchQuery ? { label: 'Add Supplier', onClick: handleCreateNew } : undefined
                }
              />
            ) : (
              <>
                <div className="data-table-header grid-suppliers">
                  <div>Name</div>
                  <div>GSTIN</div>
                  <div>Contact</div>
                  <div>Balance Due</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                <div className="data-table-body">
                  {filteredSuppliers.map((supplier) => (
                    <div
                      className={`data-table-row grid-suppliers ${!supplier.isActive ? 'inactive-row' : ''}`}
                      key={supplier.id}
                    >
                      <div className="col-name">
                        <div className="supplier-info">
                          <span className="name">{supplier.name}</span>
                        </div>
                      </div>
                      <div className="col-gstin font-mono">{supplier.gstin || '-'}</div>
                      <div className="col-contact">
                        <div style={{ fontSize: '0.85rem' }}>
                          {supplier.phone && <div>{supplier.phone}</div>}
                          {supplier.email && <div className="text-muted">{supplier.email}</div>}
                          {!supplier.phone && !supplier.email && (
                            <span className="text-muted">-</span>
                          )}
                        </div>
                      </div>
                      <div className="col-balance">
                        <span
                          className={`balance-badge ${supplier.balanceDue > 0 ? 'balance-due' : 'balance-settled'}`}
                        >
                          ₹{Math.abs(supplier.balanceDue).toFixed(2)}{' '}
                          {supplier.balanceDue > 0 ? 'Dr' : ''}
                        </span>
                      </div>
                      <div className="col-status">
                        <span
                          className={`status-badge ${supplier.isActive ? 'active' : 'inactive'}`}
                        >
                          {supplier.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="col-actions">
                        <button
                          className="action-icon-btn action-settle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettleSupplier(supplier);
                          }}
                          title="Settle Balance"
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
                            <path d="M12 1v22" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                        </button>
                        <button
                          className="action-icon-btn action-ledger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLedgerSupplier(supplier);
                          }}
                          title="Ledger"
                          style={{ color: 'var(--color-primary)' }}
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
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                          </svg>
                        </button>
                        <button
                          className="action-icon-btn action-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(supplier);
                          }}
                          title="Edit"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          className={`action-icon-btn action-toggle ${supplier.isActive ? 'active' : 'inactive'}`}
                          onClick={(e) => handleToggleStatus(supplier, e)}
                          title={supplier.isActive ? 'Deactivate Supplier' : 'Activate Supplier'}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-power"
                          >
                            <path d="M12 2v10" />
                            <path d="M18.4 6.6a9 9 0 1 1-12.77.1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {isFormOpen && <SupplierFormModal supplier={editingSupplier} onClose={handleCloseForm} />}

        <SupplierLedgerModal
          isOpen={!!ledgerSupplier}
          onClose={() => setLedgerSupplier(null)}
          supplier={ledgerSupplier}
        />

        <SupplierSettleBalanceModal
          isOpen={!!settleSupplier}
          onClose={() => setSettleSupplier(null)}
          onSuccess={() => {
            setSettleSupplier(null);
            fetchSuppliers({ includeInactive: false });
          }}
          supplier={settleSupplier}
        />

        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
          type="warning"
          confirmLabel="Deactivate"
        />
      </div>
    );
  }
);

// Inline modal form to simplify testing for now
function SupplierFormModal({
  supplier,
  onClose,
}: {
  supplier: Supplier | null;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    gstin: supplier?.gstin || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
  });

  const { execute: createSupplier, error: createError } = useIPCMutation(
    IPC_CHANNELS.SUPPLIER_CREATE
  );
  const { execute: updateSupplier, error: updateError } = useIPCMutation(
    IPC_CHANNELS.SUPPLIER_UPDATE
  );

  const error = createError || updateError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (supplier) {
      const res = await updateSupplier({ id: supplier.id, data: formData });
      if (res) {
        onClose();
      }
    } else {
      const res = await createSupplier(formData);
      if (res) {
        onClose();
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="error-banner">{error}</div>}
          <form id="supplierForm" onSubmit={handleSubmit} className="form-layout">
            <div className="form-group">
              <label>Supplier Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>GSTIN</label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
              />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="supplierForm" className="btn btn-primary">
            Save Supplier
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuppliersPage;
