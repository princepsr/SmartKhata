import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const commands: CommandItem[] = [
    // ... (rest of commands remains similar)
    {
      id: 'nav-billing',
      title: 'Go to Billing',
      subtitle: 'Create a new sale',
      icon: '💳',
      category: 'Navigation',
      action: () => navigate('/billing'),
    },
    {
      id: 'nav-products',
      title: 'Go to Products',
      subtitle: 'Manage inventory and pricing',
      icon: '📦',
      category: 'Navigation',
      action: () => navigate('/products'),
    },
    {
      id: 'nav-customers',
      title: 'Go to Customers',
      subtitle: 'Manage customer database',
      icon: '👥',
      category: 'Navigation',
      action: () => navigate('/customers'),
    },
    {
      id: 'nav-reports',
      title: 'Go to Reports',
      subtitle: 'View sales and analytics',
      icon: '📊',
      category: 'Navigation',
      action: () => navigate('/reports'),
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      subtitle: 'App configuration',
      icon: '⚙️',
      category: 'Navigation',
      action: () => navigate('/settings'),
    },
    {
      id: 'action-new-product',
      title: 'Add New Product',
      subtitle: 'Quickly create a new item',
      icon: '➕',
      category: 'Actions',
      action: () => {
        navigate('/products?action=add');
      },
    },
    {
      id: 'action-new-customer',
      title: 'Add New Customer',
      subtitle: 'Register a new buyer',
      icon: '👤',
      category: 'Actions',
      action: () => {
        navigate('/customers?action=add');
      },
    },
    {
      id: 'report-sales',
      title: 'Sales Report',
      subtitle: 'View daily sales summary',
      icon: '💰',
      category: 'Search',
      action: () => {
        navigate('/reports?tab=sales');
      },
    },
    {
      id: 'report-stock',
      title: 'Stock Summary',
      subtitle: 'Check inventory levels',
      icon: '📦',
      category: 'Search',
      action: () => {
        navigate('/reports?tab=stock');
      },
    },
    {
      id: 'report-gst',
      title: 'GST Report',
      subtitle: 'View tax summaries',
      icon: '📑',
      category: 'Search',
      action: () => {
        navigate('/reports?tab=gst');
      },
    },
    {
      id: 'billing-clear',
      title: 'Clear Current Cart',
      subtitle: 'Reset the billing screen',
      icon: '🧹',
      category: 'Actions',
      action: () => {
        navigate('/billing?action=clear-cart');
      },
    },
    {
      id: 'billing-history',
      title: 'View Bill History',
      subtitle: 'Open recent transactions',
      icon: '🕒',
      category: 'Search',
      action: () => {
        navigate('/billing?action=history');
      },
    },
    {
      id: 'settings-shop',
      title: 'Shop Settings',
      subtitle: 'Edit business profile',
      icon: '🏪',
      category: 'Navigation',
      action: () => {
        navigate('/settings?tab=shop');
      },
    },
    {
      id: 'settings-printing',
      title: 'Printer Settings',
      subtitle: 'Configure receipts',
      icon: '🖨️',
      category: 'Navigation',
      action: () => {
        navigate('/settings?tab=printing');
      },
    },
    {
      id: 'settings-data',
      title: 'Backup & Data',
      subtitle: 'Improt/Export & Recovery',
      icon: '💾',
      category: 'Navigation',
      action: () => {
        navigate('/settings?tab=data');
      },
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
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
