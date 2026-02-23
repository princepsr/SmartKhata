import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIPC } from '../hooks/useIPC';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { formatCurrency } from '../utils/billing-math';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CustomerLedgerModal } from '../components/customers/CustomerLedgerModal';
import { SettleBalanceModal } from '../components/customers/SettleBalanceModal';
import { ConfirmModal } from '../components/ConfirmModal';
import EmptyState from '../components/common/EmptyState';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const {
    data: paginatedData,
    loading,
    error,
    execute: fetchItems,
  } = useIPC<{ items: Customer[]; totalCount: number; hasMore: boolean; page: number }>(
    debouncedSearchQuery.trim().length >= 1
      ? IPC_CHANNELS.CUSTOMER_SEARCH
      : IPC_CHANNELS.CUSTOMER_LIST
  );

  const { execute: toggleStatus } = useIPC(IPC_CHANNELS.CUSTOMER_TOGGLE_STATUS);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const isInitialLoading = loading && customers.length === 0;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showInactive, setShowInactive] = useLocalStorage('customers_show_inactive', false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  // New Modal States
  const [settleCustomer, setSettleCustomer] = useState<Customer | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

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

  const editingCustomer = useMemo(
    () =>
      editingCustomerId && customers
        ? customers.find((c) => c.id === editingCustomerId) || null
        : null,
    [customers, editingCustomerId]
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial fetch / Search trigger
  useEffect(() => {
    setPage(1);
    setCustomers([]);
    fetchItems({
      includeInactive: showInactive,
      query: debouncedSearchQuery,
      page: 1,
      pageSize: 100,
    });
  }, [fetchItems, showInactive, debouncedSearchQuery]);

  // Fetch more items
  const fetchNextPage = useCallback(() => {
    if (loading || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems({
      includeInactive: showInactive,
      query: debouncedSearchQuery,
      page: nextPage,
      pageSize: 100,
    });
  }, [fetchItems, showInactive, debouncedSearchQuery, page, loading, hasMore]);

  // Handle data updates
  useEffect(() => {
    if (paginatedData) {
      if (paginatedData.page === 1) {
        setCustomers(paginatedData.items);
      } else {
        setCustomers((prev) => [...prev, ...paginatedData.items]);
      }
      setHasMore(paginatedData.hasMore);
      setTotalCount(paginatedData.totalCount);
    }
  }, [paginatedData]);

  // Intersection Observer for Infinite Scroll
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || loading) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      {
        root: listContainerRef.current,
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, fetchNextPage]);

  // Handle global actions (e.g. from Command Center)
  const handleAddCustomer = useCallback(() => {
    setEditingCustomerId(null);
    setIsFormOpen(true);
  }, []);

  // Handle global actions (e.g. from Command Center)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add') {
      handleAddCustomer();
      // Remove the param
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, handleAddCustomer]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // New customer on Alt+N
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        handleAddCustomer();
      }
      // Focus search on Ctrl+F
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAddCustomer]);

  const handleEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomerId(customer.id);
    setIsFormOpen(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setPage(1);
    setCustomers([]);
    fetchItems({
      includeInactive: showInactive,
      query: debouncedSearchQuery,
      page: 1,
      pageSize: 100,
    });
    setIsFormOpen(false);
  }, [fetchItems, showInactive, debouncedSearchQuery]);

  const handleToggleStatus = useCallback(
    async (customer: Customer, e: React.MouseEvent) => {
      e.stopPropagation();
      const isDeactivating = customer.isActive;

      if (isDeactivating) {
        setConfirmDialog({
          isOpen: true,
          title: 'Deactivate Customer',
          message: `Are you sure you want to deactivate "${customer.name}"? This will hide them from the billing search.`,
          onConfirm: async () => {
            try {
              await toggleStatus({ id: customer.id, isActive: false });
              handleFormSuccess(); // Refresh
            } catch (err) {
              console.error('Failed to toggle status:', err);
            }
          },
        });
        return;
      }

      try {
        await toggleStatus({ id: customer.id, isActive: !customer.isActive });
        handleFormSuccess();
      } catch (err) {
        console.error('Failed to toggle status:', err);
      }
    },
    [toggleStatus, handleFormSuccess]
  );

  // No client-side search needed anymore, using server-side
  const filteredCustomers = customers;

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
  }, [filteredCustomers, selectedIndex, handleAddCustomer, handleEditCustomer]);

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
            <div
              className="filter-group"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  color: '#666',
                }}
              >
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show Inactive
              </label>
            </div>
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
          {isInitialLoading && <div className="no-results">Loading customers...</div>}
          {error && (
            <div className="no-results" style={{ color: 'var(--color-error)' }}>
              Error: {error}
            </div>
          )}

          {(!isInitialLoading || customers.length > 0) && !error && (
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
                <EmptyState
                  title="No Customers Found"
                  message={
                    searchQuery
                      ? `We couldn't find any customers matching "${searchQuery}".`
                      : 'Build your customer database to track sales and loyalty.'
                  }
                  icon="👥"
                  action={
                    !searchQuery
                      ? { label: 'Add New Customer', onClick: handleAddCustomer }
                      : undefined
                  }
                />
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
                    <div
                      className="col-actions"
                      style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}
                    >
                      <button
                        className="action-icon-btn action-settle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettleCustomer(customer);
                        }}
                        title="Settle Balance"
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
                        >
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                      </button>
                      <button
                        className="action-icon-btn action-ledger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLedgerCustomer(customer);
                        }}
                        title="View Ledger"
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
                        >
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                      </button>
                      <button
                        className="action-icon-btn action-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCustomer(customer);
                        }}
                        title="Edit Customer"
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
                          className="lucide lucide-pencil"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                      <button
                        className={`action-icon-btn action-toggle ${customer.isActive ? 'active' : 'inactive'}`}
                        onClick={(e) => handleToggleStatus(customer, e)}
                        title={customer.isActive ? 'Deactivate Customer' : 'Activate Customer'}
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
                ))
              )}

              {hasMore && (
                <div ref={loaderRef} className="loading-more">
                  {loading ? 'Loading more customers...' : 'Scroll for more'}
                </div>
              )}

              {!hasMore && customers.length > 0 && totalCount > 100 && (
                <div className="end-of-list">Showing all {totalCount} customers</div>
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

      <SettleBalanceModal
        isOpen={!!settleCustomer}
        onClose={() => setSettleCustomer(null)}
        customer={settleCustomer}
        onSuccess={() => {
          setSettleCustomer(null);
          // Refresh customer list
          handleFormSuccess();
        }}
      />

      <CustomerLedgerModal
        isOpen={!!ledgerCustomer}
        onClose={() => setLedgerCustomer(null)}
        customer={ledgerCustomer}
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
};

export default CustomersPage;
