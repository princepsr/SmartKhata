import React, { useState, useEffect, useMemo } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import './SuppliersPage.css';

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  email: string | null;
  balanceDue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SuppliersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const {
    data,
    loading,
    error,
    execute: fetchSuppliers,
  } = useIPC<{ items: Supplier[] }>(IPC_CHANNELS.SUPPLIER_LIST);

  useEffect(() => {
    fetchSuppliers({ includeInactive: false });
  }, [fetchSuppliers]);

  const suppliers = useMemo(() => data?.items || [], [data]);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) {
      return suppliers;
    }
    const lowerQuery = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        (s.phone && s.phone.includes(lowerQuery)) ||
        (s.gstin && s.gstin.toLowerCase().includes(lowerQuery))
    );
  }, [suppliers, searchQuery]);

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
    fetchSuppliers({ includeInactive: false });
  };

  return (
    <div className="page-container suppliers-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Procurement & Suppliers</h1>
          <p className="page-subtitle">Manage your suppliers and purchase orders</p>
        </div>
        <div className="header-actions">
          <div className="search-bar">
            <svg /* Search Icon */
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
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <svg /* Plus Icon */
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

      <main className="page-content">
        {error && <div className="error-banner">{error}</div>}

        <div className="card table-card table-container">
          {loading ? (
            <div className="table-loading">Loading suppliers...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="empty-state">
              <svg /* Empty Icon */
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <h3>No Suppliers Found</h3>
              <p>
                {searchQuery
                  ? 'Try matching different keywords.'
                  : 'Add your first supplier to start taking purchases.'}
              </p>
              {!searchQuery && (
                <button className="btn btn-primary btn-sm mt-md" onClick={handleCreateNew}>
                  Add Supplier
                </button>
              )}
            </div>
          ) : (
            <table className="data-table has-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact Info</th>
                  <th>GSTIN</th>
                  <th className="text-right">Balance Due</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="supplier-name">{supplier.name}</div>
                    </td>
                    <td>
                      <div className="supplier-contact">
                        {supplier.phone && <div>{supplier.phone}</div>}
                        {supplier.email && (
                          <div className="text-muted text-sm">{supplier.email}</div>
                        )}
                        {!supplier.phone && !supplier.email && (
                          <span className="text-muted">-</span>
                        )}
                      </div>
                    </td>
                    <td>{supplier.gstin || '-'}</td>
                    <td className="text-right">
                      <span
                        className={`balance-badge ${supplier.balanceDue > 0 ? 'balance-due' : 'balance-settled'}`}
                      >
                        ₹{Math.abs(supplier.balanceDue).toFixed(2)}{' '}
                        {supplier.balanceDue > 0 ? 'Dr' : ''}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`status-badge ${supplier.isActive ? 'active' : 'inactive'}`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right actions-cell">
                      <button
                        className="btn btn-icon"
                        onClick={() => handleEdit(supplier)}
                        title="Edit"
                      >
                        <svg /* Edit Icon */
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Basic form modal placeholder for now */}
      {isFormOpen && <SupplierFormModal supplier={editingSupplier} onClose={handleCloseForm} />}
    </div>
  );
}

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
