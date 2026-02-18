import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useIPC } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../utils/billing-math';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import './CustomersPage.css';

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address?: string;
  email?: string;
  balanceDue: number; // Positive = Due from customer, Negative = Advance from customer
  isActive: boolean;
}

const CustomersPage: React.FC = () => {
  const {
    data: customers,
    loading,
    error,
    execute: fetchCustomers,
  } = useIPC<Customer[]>(IPC_CHANNELS.CUSTOMER_LIST);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  const editingCustomer = useMemo(
    () =>
      editingCustomerId && customers
        ? customers.find((c) => c.id === editingCustomerId) || null
        : null,
    [customers, editingCustomerId]
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAddCustomer = () => {
    setEditingCustomerId(null);
    setIsFormOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomerId(customer.id);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    fetchCustomers();
    setIsFormOpen(false);
  };

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!customers) {
      return [];
    }

    if (!searchQuery) {
      return customers;
    }

    const lowerQuery = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        (c.phone && c.phone.includes(lowerQuery)) ||
        c.address?.toLowerCase().includes(lowerQuery)
    );
  }, [customers, searchQuery]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('.modal-overlay')) {
        return;
      }

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleAddCustomer();
        return;
      }

      if (filteredCustomers.length === 0) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCustomers.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCustomers[selectedIndex]) {
            handleEditCustomer(filteredCustomers[selectedIndex]);
          }
          break;
        case 'Insert':
          e.preventDefault();
          handleAddCustomer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredCustomers, selectedIndex]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (listContainerRef.current && listContainerRef.current.children.length > 0) {
      const selectedElement = listContainerRef.current.children[selectedIndex + 1] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Reset selection on search
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return (
    <div className="page customers-page">
      <div className="page-content-wrapper animate-fade-in">
        <header className="page-header">
          <h1 className="page-title">Customers & Udhaar</h1>
          <div className="header-actions">
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search Name / Phone / Address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" onClick={handleAddCustomer}>
              + Add Customer (Ctrl+N)
            </button>
          </div>
        </header>

        <div className="customers-content">
          {loading && <div className="no-results">Loading customers...</div>}
          {error && (
            <div className="no-results" style={{ color: 'var(--color-error)' }}>
              Error: {error}
            </div>
          )}

          {!loading && !error && (
            <div className="data-table-container" ref={listContainerRef}>
              <div className="data-table-header">
                <div className="col-name">Name</div>
                <div className="col-phone">Phone</div>
                <div className="col-address">Address</div>
                <div className="col-balance">Balance</div>
                <div className="col-status">Status</div>
                <div className="col-actions">Actions</div>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="no-results">No customers found</div>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className={`data-table-row ${index === selectedIndex ? 'selected' : ''} ${!customer.isActive ? 'inactive-row' : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => handleEditCustomer(customer)}
                  >
                    <div className="col-name">{customer.name}</div>
                    <div className="col-phone">{customer.phone}</div>
                    <div className="col-address" title={customer.address}>
                      {customer.address || '-'}
                    </div>
                    <div
                      className={`col-balance ${customer.balanceDue > 0 ? 'balance-due' : customer.balanceDue < 0 ? 'balance-advance' : ''}`}
                    >
                      {customer.balanceDue !== 0 ? formatCurrency(customer.balanceDue) : '₹ 0.00'}
                      {customer.balanceDue > 0 ? ' (Due)' : customer.balanceDue < 0 ? ' (Adv)' : ''}
                    </div>
                    <div className="col-status">
                      <span className={`status-badge ${customer.isActive ? 'active' : 'inactive'}`}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="col-actions">
                      <button
                        className="btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCustomer(customer);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCustomerId(null);
        }}
        onSuccess={handleFormSuccess}
        initialData={editingCustomer}
      />
    </div>
  );
};

export default CustomersPage;
