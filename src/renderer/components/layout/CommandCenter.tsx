import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        title: t('command_center.commands.billing'),
        subtitle: t('command_center.commands.billing_sub'),
        icon: '💳',
        category: 'Actions',
        action: () => navigate('/billing'),
      },
      {
        id: 'action-new-product',
        title: t('command_center.commands.new_product'),
        subtitle: t('command_center.commands.new_product_sub'),
        icon: '📦',
        category: 'Actions',
        action: () => navigate('/products?action=add'),
      },
    ];

    if (settings.gstEnabled) {
      list.push(
        {
          id: 'action-new-purchase',
          title: t('command_center.commands.new_purchase'),
          subtitle: t('command_center.commands.new_purchase_sub'),
          icon: '📥',
          category: 'Actions',
          action: () => navigate('/purchases?action=purchase'),
        },
        {
          id: 'action-new-po',
          title: t('command_center.commands.new_po'),
          subtitle: t('command_center.commands.new_po_sub'),
          icon: '📝',
          category: 'Actions',
          action: () => navigate('/purchases?action=order'),
        }
      );
    }

    if (settings.expensesEnabled) {
      list.push({
        id: 'action-new-expense',
        title: t('command_center.commands.new_expense'),
        subtitle: t('command_center.commands.new_expense_sub'),
        icon: '💸',
        category: 'Actions',
        action: () => navigate('/expenses?action=add'),
      });
    }

    if (settings.quotationsEnabled) {
      list.push({
        id: 'action-new-quotation',
        title: t('command_center.commands.new_quotation'),
        subtitle: t('command_center.commands.new_quotation_sub'),
        icon: '📄',
        category: 'Actions',
        action: () => navigate('/billing?type=quotation'),
      });
    }

    if (settings.customersEnabled) {
      list.push({
        id: 'action-new-customer',
        title: t('command_center.commands.new_customer'),
        subtitle: t('command_center.commands.new_customer_sub'),
        icon: '👥',
        category: 'Actions',
        action: () => navigate('/customers?action=add'),
      });
    }

    list.push({
      id: 'billing-clear',
      title: t('command_center.commands.clear_cart'),
      subtitle: t('command_center.commands.clear_cart_sub'),
      icon: '🧹',
      category: 'Actions',
      action: () => navigate('/billing?action=clear-cart'),
    });

    // --- NAVIGATION ---
    list.push({
      id: 'nav-products',
      title: t('command_center.commands.view_inventory'),
      subtitle: t('command_center.commands.view_inventory_sub'),
      icon: '📦',
      category: 'Navigation',
      action: () => navigate('/products'),
    });

    if (settings.gstEnabled) {
      list.push({
        id: 'nav-purchases',
        title: t('command_center.commands.view_procurement'),
        subtitle: t('command_center.commands.view_procurement_sub'),
        icon: '🛒',
        category: 'Navigation',
        action: () => navigate('/purchases'),
      });
    }

    if (settings.customersEnabled) {
      list.push(
        {
          id: 'nav-customers',
          title: t('command_center.commands.view_customers'),
          subtitle: t('command_center.commands.view_customers_sub'),
          icon: '👥',
          category: 'Navigation',
          action: () => navigate('/customers'),
        },
        {
          id: 'nav-suppliers',
          title: t('command_center.commands.suppliers'),
          subtitle: t('command_center.commands.suppliers_sub'),
          icon: '🤝',
          category: 'Navigation',
          action: () => navigate('/purchases?tab=suppliers'),
        }
      );
    }

    if (settings.expensesEnabled) {
      list.push({
        id: 'nav-expenses',
        title: t('command_center.commands.view_expenses'),
        subtitle: t('command_center.commands.view_expenses_sub'),
        icon: '💸',
        category: 'Navigation',
        action: () => navigate('/expenses'),
      });
    }

    if (settings.quotationsEnabled) {
      list.push({
        id: 'nav-quotations',
        title: t('command_center.commands.view_quotations'),
        subtitle: t('command_center.commands.view_quotations_sub'),
        icon: '📄',
        category: 'Navigation',
        action: () => navigate('/quotations'),
      });
    }

    if (settings.barcodeGenEnabled) {
      list.push({
        id: 'nav-barcode',
        title: t('command_center.commands.barcode'),
        subtitle: t('command_center.commands.barcode_sub'),
        icon: '🏷️',
        category: 'Navigation',
        action: () => navigate('/barcode-gen'),
      });
    }

    // --- REPORTS & SEARCH ---
    list.push(
      {
        id: 'report-summary',
        title: t('command_center.commands.reports'),
        subtitle: t('command_center.commands.reports_sub'),
        icon: '📊',
        category: 'Search',
        action: () => navigate('/reports'),
      },
      {
        id: 'report-sales',
        title: t('command_center.commands.sales_report'),
        subtitle: t('command_center.commands.sales_report_sub'),
        icon: '💰',
        category: 'Search',
        action: () => navigate('/reports?tab=sales'),
      },
      {
        id: 'report-stock',
        title: t('command_center.commands.stock_summary'),
        subtitle: t('command_center.commands.stock_summary_sub'),
        icon: '📦',
        category: 'Search',
        action: () => navigate('/reports?tab=stock'),
      }
    );

    if (settings.enableBatchTracking) {
      list.push({
        id: 'report-expiry',
        title: t('command_center.commands.expiry_report'),
        subtitle: t('command_center.commands.expiry_report_sub'),
        icon: '⏳',
        category: 'Search',
        action: () => navigate('/reports?tab=near-expiry'),
      });
    }

    if (settings.gstEnabled) {
      list.push({
        id: 'report-gst',
        title: t('command_center.commands.gst_report'),
        subtitle: t('command_center.commands.gst_report_sub'),
        icon: '📑',
        category: 'Search',
        action: () => navigate('/reports?tab=gst'),
      });
    }

    list.push({
      id: 'billing-history',
      title: t('command_center.commands.bill_history'),
      subtitle: t('command_center.commands.bill_history_sub'),
      icon: '🕒',
      category: 'Search',
      action: () => navigate('/billing?action=history'),
    });

    // --- SETTINGS ---
    list.push(
      {
        id: 'settings-general',
        title: t('command_center.commands.settings_gen'),
        subtitle: t('command_center.commands.settings_gen_sub'),
        icon: '⚙️',
        category: 'Navigation',
        action: () => navigate('/settings'),
      },
      {
        id: 'settings-shop',
        title: t('command_center.commands.settings_shop'),
        subtitle: t('command_center.commands.settings_shop_sub'),
        icon: '🏪',
        category: 'Navigation',
        action: () => navigate('/settings?tab=shop'),
      },
      {
        id: 'settings-inventory',
        title: t('command_center.commands.settings_inv'),
        subtitle: t('command_center.commands.settings_inv_sub'),
        icon: '📦',
        category: 'Navigation',
        action: () => navigate('/settings?tab=inventory'),
      },
      {
        id: 'settings-printing',
        title: t('command_center.commands.settings_print'),
        subtitle: t('command_center.commands.settings_print_sub'),
        icon: '🖨️',
        category: 'Navigation',
        action: () => navigate('/settings?tab=printing'),
      },
      {
        id: 'settings-licensing',
        title: t('command_center.commands.settings_lic'),
        subtitle: t('command_center.commands.settings_lic_sub'),
        icon: '🔑',
        category: 'Navigation',
        action: () => navigate('/settings?tab=licensing'),
      },
      {
        id: 'settings-data',
        title: t('command_center.commands.settings_data'),
        subtitle: t('command_center.commands.settings_data_sub'),
        icon: '💾',
        category: 'Navigation',
        action: () => navigate('/settings?tab=data'),
      },
      {
        id: 'settings-privacy',
        title: t('command_center.commands.settings_priv'),
        subtitle: t('command_center.commands.settings_priv_sub'),
        icon: '🔒',
        category: 'Navigation',
        action: () => navigate('/settings?tab=privacy'),
      },
      {
        id: 'settings-debug',
        title: t('command_center.commands.settings_debug'),
        subtitle: t('command_center.commands.settings_debug_sub'),
        icon: '🛠️',
        category: 'Navigation',
        action: () => navigate('/settings?tab=debug'),
      }
    );

    return list;
  }, [settings, navigate, t]);

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
            placeholder={t('command_center.placeholder')}
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
                <span className="command-category">
                  {t(`common.${cmd.category.toLowerCase()}`)}
                </span>
              </div>
            ))
          ) : (
            <div className="command-no-results">{t('command_center.no_results')}</div>
          )}
        </div>

        <div className="command-center-footer">
          <div className="footer-tip">
            <kbd>↑↓</kbd> {t('command_center.footer_tip')} <kbd>Enter</kbd>{' '}
            {t('command_center.footer_select')} <kbd>Esc</kbd> {t('command_center.footer_close')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
