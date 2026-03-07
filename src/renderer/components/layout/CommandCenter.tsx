import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettingsStore } from '../../store/useAppSettingsStore';
import './CommandCenter.css';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
  category: 'Navigation' | 'Actions' | 'Search';
}

const CommandCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { settings } = useAppSettingsStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Toggle Command Center with Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when query or filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && resultsRef.current) {
      const activeElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // --- QUICK ACTIONS ---
      {
        id: 'action-billing',
        title: 'New Sale / Billing',
        subtitle: 'Open the POS interface',
        icon: '💳',
        category: 'Actions',
        action: () => navigate('/billing'),
      },
      {
        id: 'action-new-product',
        title: 'Add New Product',
        subtitle: 'Create a new inventory item',
        icon: '📦',
        category: 'Actions',
        action: () => navigate('/products?action=add'),
      },
    ];

    if (settings.gstEnabled) {
      list.push(
        {
          id: 'action-new-purchase',
          title: 'Record New Purchase',
          subtitle: 'Log a supplier invoice',
          icon: '📥',
          category: 'Actions',
          action: () => navigate('/purchases?action=purchase'),
        },
        {
          id: 'action-new-po',
          title: 'Create Purchase Order',
          subtitle: 'Draft a new order',
          icon: '📝',
          category: 'Actions',
          action: () => navigate('/purchases?action=order'),
        }
      );
    }

    if (settings.expensesEnabled) {
      list.push({
        id: 'action-new-expense',
        title: 'Record New Expense',
        subtitle: 'Log a shop expenditure',
        icon: '💸',
        category: 'Actions',
        action: () => navigate('/expenses?action=add'),
      });
    }

    if (settings.quotationsEnabled) {
      list.push({
        id: 'action-new-quotation',
        title: 'Create New Quotation',
        subtitle: 'Draft a new estimate',
        icon: '📄',
        category: 'Actions',
        action: () => navigate('/billing?type=quotation'),
      });
    }

    if (settings.customersEnabled) {
      list.push({
        id: 'action-new-customer',
        title: 'Add New Customer',
        subtitle: 'Register a new buyer',
        icon: '👥',
        category: 'Actions',
        action: () => navigate('/customers?action=add'),
      });
    }

    list.push({
      id: 'billing-clear',
      title: 'Clear Current Cart',
      subtitle: 'Reset the billing screen',
      icon: '🧹',
      category: 'Actions',
      action: () => navigate('/billing?action=clear-cart'),
    });

    // --- NAVIGATION ---
    list.push({
      id: 'nav-products',
      title: 'View Inventory',
      subtitle: 'Manage stock and pricing',
      icon: '📦',
      category: 'Navigation',
      action: () => navigate('/products'),
    });

    if (settings.gstEnabled) {
      list.push({
        id: 'nav-purchases',
        title: 'View Procurement',
        subtitle: 'Purchases, Invoices & Orders',
        icon: '🛒',
        category: 'Navigation',
        action: () => navigate('/purchases'),
      });
    }

    if (settings.customersEnabled) {
      list.push(
        {
          id: 'nav-customers',
          title: 'View Customers',
          subtitle: 'Customer database & ledger',
          icon: '👥',
          category: 'Navigation',
          action: () => navigate('/customers'),
        },
        {
          id: 'nav-suppliers',
          title: 'Suppliers & Ledgers',
          subtitle: 'Manage vendor accounts',
          icon: '🤝',
          category: 'Navigation',
          action: () => navigate('/purchases?tab=suppliers'),
        }
      );
    }

    if (settings.expensesEnabled) {
      list.push({
        id: 'nav-expenses',
        title: 'View Expenses',
        subtitle: 'Shop expenditure history',
        icon: '💸',
        category: 'Navigation',
        action: () => navigate('/expenses'),
      });
    }

    if (settings.quotationsEnabled) {
      list.push({
        id: 'nav-quotations',
        title: 'View Quotations',
        subtitle: 'Manage estimates and quotes',
        icon: '📄',
        category: 'Navigation',
        action: () => navigate('/quotations'),
      });
    }

    if (settings.barcodeGenEnabled) {
      list.push({
        id: 'nav-barcode',
        title: 'Barcode Generator',
        subtitle: 'Create & print product labels',
        icon: '🏷️',
        category: 'Navigation',
        action: () => navigate('/barcode-gen'),
      });
    }

    // --- REPORTS & SEARCH ---
    list.push(
      {
        id: 'report-summary',
        title: 'Business Reports',
        subtitle: 'Analytics & summaries',
        icon: '📊',
        category: 'Search',
        action: () => navigate('/reports'),
      },
      {
        id: 'report-sales',
        title: 'Sales Report',
        subtitle: 'View daily sales summary',
        icon: '💰',
        category: 'Search',
        action: () => navigate('/reports?tab=sales'),
      },
      {
        id: 'report-stock',
        title: 'Stock Summary',
        subtitle: 'Check inventory levels',
        icon: '📦',
        category: 'Search',
        action: () => navigate('/reports?tab=stock'),
      }
    );

    if (settings.enableBatchTracking) {
      list.push({
        id: 'report-expiry',
        title: 'Near Expiry Items',
        subtitle: 'Items expiring soon',
        icon: '⏳',
        category: 'Search',
        action: () => navigate('/reports?tab=near-expiry'),
      });
    }

    if (settings.gstEnabled) {
      list.push({
        id: 'report-gst',
        title: 'GST / Tax Report',
        subtitle: 'GSTR-1 & Input Tax Credit',
        icon: '📑',
        category: 'Search',
        action: () => navigate('/reports?tab=gst'),
      });
    }

    list.push({
      id: 'billing-history',
      title: 'View Bill History',
      subtitle: 'Open recent transactions',
      icon: '🕒',
      category: 'Search',
      action: () => navigate('/billing?action=history'),
    });

    // --- SETTINGS ---
    list.push(
      {
        id: 'settings-general',
        title: 'App Settings',
        subtitle: 'General configuration',
        icon: '⚙️',
        category: 'Navigation',
        action: () => navigate('/settings'),
      },
      {
        id: 'settings-shop',
        title: 'Shop Profile',
        subtitle: 'Edit business details',
        icon: '🏪',
        category: 'Navigation',
        action: () => navigate('/settings?tab=shop'),
      },
      {
        id: 'settings-inventory',
        title: 'Inventory Rules',
        subtitle: 'Business logic & tracking',
        icon: '📦',
        category: 'Navigation',
        action: () => navigate('/settings?tab=inventory'),
      },
      {
        id: 'settings-printing',
        title: 'Printer Settings',
        subtitle: 'Configure receipts & thermal',
        icon: '🖨️',
        category: 'Navigation',
        action: () => navigate('/settings?tab=printing'),
      },
      {
        id: 'settings-licensing',
        title: 'License & Subscription',
        subtitle: 'Manage your plan',
        icon: '🔑',
        category: 'Navigation',
        action: () => navigate('/settings?tab=licensing'),
      },
      {
        id: 'settings-data',
        title: 'Backup & Data',
        subtitle: 'Import, Export & Reset',
        icon: '💾',
        category: 'Navigation',
        action: () => navigate('/settings?tab=data'),
      },
      {
        id: 'settings-privacy',
        title: 'Privacy & Terms',
        subtitle: 'Legal information',
        icon: '🔒',
        category: 'Navigation',
        action: () => navigate('/settings?tab=privacy'),
      },
      {
        id: 'settings-debug',
        title: 'System Debug',
        subtitle: 'Health & dev tools',
        icon: '🛠️',
        category: 'Navigation',
        action: () => navigate('/settings?tab=debug'),
      }
    );

    return list;
  }, [settings, navigate]);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase()) ||
      cmd.subtitle?.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredCommands.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 5, filteredCommands.length - 1));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 5, 0));
    } else if (e.key === 'Enter') {
      // ... (rest of handleKeyDown)
      e.preventDefault();
      const command = filteredCommands[selectedIndex];
      if (command) {
        command.action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="command-center-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-center-modal" onClick={(e) => e.stopPropagation()}>
        <div className="command-center-header">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="command-center-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="esc-key">ESC</kbd>
        </div>

        <div className="command-center-results" ref={resultsRef}>
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  cmd.action();
                  setIsOpen(false);
                }}
              >
                <span className="command-icon">{cmd.icon}</span>
                <div className="command-text">
                  <span className="command-title">{cmd.title}</span>
                  {cmd.subtitle && <span className="command-subtitle">{cmd.subtitle}</span>}
                </div>
                <span className="command-category">{cmd.category}</span>
              </div>
            ))
          ) : (
            <div className="command-no-results">No commands found</div>
          )}
        </div>

        <div className="command-center-footer">
          <div className="footer-tip">
            <kbd>↑↓</kbd> to navigate <kbd>Enter</kbd> to select <kbd>Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
