# Command Center Architecture (Unified Navigation & Action Hub)

The **Command Center** is a high-speed, keyboard-first navigation and action hub accessible globally via `Ctrl+K`. It allows users to perform transactions, switch contexts, and trigger modals without leaving their current screen.

---

## 1. Technical Implementation

### Global Hotkey Listener
The Command Center is mounted in the root `Layout.tsx` and uses a global `useEffect` hook to intercept keyboard events.
- **Trigger**: `(e.ctrlKey || e.metaKey) && e.key === 'k'`.
- **Intervention**: `e.preventDefault()` is called to block default browser "Search" or "Address Bar" focus, ensuring SmartKhata captures the intent.
- **Dismissal**: Handled via the `Escape` key or clicking the backdrop overlay.

### State Management
- **Local State**: Managed via `useState` for `isOpen`, `query` (search string), and `selectedIndex` (keyboard navigation index).
- **Auto-Focus**: A `useRef` to the input element ensures that the search bar is focused within 50ms of opening, allowing immediate typing.

### Action Dispatcher (URL Pathing)
Rather than using complex global events, the Command Center leverages **React Router** to dispatch actions.
- **Navigation Actions**: Direct `navigate('/path')`.
- **Functional Actions**: `navigate('/path?action=add')`. Target pages use the `useSearchParams` hook to detect these flags and automatically trigger UI modals or focus specific fields.

---

## 2. Command Registry & Indexing

The system currently supports three categories of commands:

### Navigation Commands
| Title | Subtitle | Destination |
|-------|----------|-------------|
| Go to Billing | Create a new sale | `/billing` |
| Go to Products | Manage inventory | `/products` |
| Go to Customers | Manage database | `/customers` |
| Go to Reports | View analytics | `/reports` |
| Go to Settings | App configuration | `/settings` |

### Functional Actions
| Title | Action Detail | Triggered URL |
|-------|---------------|---------------|
| Add New Product | Opens Create Modal | `/products?action=add` |
| Add New Customer | Opens Register Modal | `/customers?action=add` |
| Clear Current Cart | Resets billing state | `/billing?action=clear-cart` |

### Settings & Reporting Deep-Links
| Title | Deep-Link Tab | Triggered URL |
|-------|---------------|---------------|
| Sales Report | Daily summary | `/reports?tab=sales` |
| Stock Summary | Inventory levels | `/reports?tab=stock` |
| GST Report | Tax summaries | `/reports?tab=gst` |
| Printer Settings | Configure receipts | `/settings?tab=printing` |
| Backup & Data | Data management | `/settings?tab=data` |

---

## 3. Keyboard Interaction Logic

The `handleKeyDown` function implements a robust selection system:
- **Arrow Keys**: Cycles `selectedIndex` between `0` and `filteredCommands.length - 1`.
- **Pagination**: `PageUp` and `PageDown` jump the selection by `±5` items for faster scrolling in long lists.
- **Execution**: `Enter` triggers the `action()` associated with the selected command and automatically closes the modal.
- **Scroll Alignment**: The `useEffect` hook monitors `selectedIndex` and calls `scrollIntoView({ block: 'nearest' })` on the active list item to ensure it's always visible during keyboard navigation.

---

## 4. UI & Aesthetics

### Visual Design
- **Backdrop**: `command-center-overlay` with a semi-transparent dark background and `pointer-events: auto` to trap clicks.
- **Modal**: `command-center-modal` featuring glassmorphism (where supported) and high-density typography.
- **Highlighting**: Selected items use the `--color-primary` background for clear visual feedback.

### Usage Tips (Footer)
The footer provide persistent hints for shortcut keys (`↑↓`, `Enter`, `Esc`), ensuring new users can discover the power-user shortcuts immediately.

---

## Technical Reference
- **React Component**: `src/renderer/components/layout/CommandCenter.tsx`
- **Styling**: `src/renderer/components/layout/CommandCenter.css`
- **Integration**: Mounted in `src/renderer/App.tsx` or `Layout.tsx` for global persistence.
