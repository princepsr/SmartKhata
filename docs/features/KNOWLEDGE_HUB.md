# Knowledge Hub (Help & Support)

The Knowledge Hub is a built-in, central repository of detailed guides and expert tips designed to help shopkeepers master SmartKhata POS without external training.

## Overview

Unlike traditional help menus, the Knowledge Hub provides **High-Density Documentation** synchronized with the specific features of the application. It is accessible via the sidebar and as a quick "Help Drawer" from any screen.

## Key Features

### 1. Bilingual Support

- Full documentation available in **English** and **Hindi**.
- Seamless switching based on the current app language settings.

### 2. High-Density Content

Every module follows a professional **"WHY / WORKFLOW / PRO TIP"** structure:

- **WHY**: Explains the business value of the feature (e.g., why tracking Udhaar is critical for cash flow).
- **WORKFLOW**: Step-by-step instructions for from-scratch setup and daily usage.
- **PRO TIP**: Expert shortcuts and advanced logic (e.g., F9 for quick checkout, bulk excel imports).

### 3. Deep Integration

- **Contextual Help**: From any screen, users can open the "Help Drawer" to get quick answers without losing their current work.
- **Full Guide Navigation**: Direct links from the drawer to the comprehensive full-page Knowledge Hub.

### 4. Searchable Indices

- Optimized for quick lookup of keyboard shortcuts, GST filing procedures, and data safety protocols.

## Modules Covered

1. **Getting Started**: Initial shop setup, printer configuration, and onboarding.
2. **Billing & Sales**: High-speed checkout, payment modes (Cash/UPI/Mixed), and returns.
3. **Inventory Management**: Stock tracking, low-stock alerts, and batch/expiry logic.
4. **Customers & Udhaar**: Credit tracking, settlement logs, and WhatsApp reminders.
5. **Purchases & Suppliers**: Purchase invoices, ITC tracking, and supplier ledgers.
6. **Shop Expenses**: Tracking overheads and calculating Net Profit.
7. **Quotations & Estimates**: Creating draft estimates and converting to bills.
8. **Barcode Generator**: Custom labeling and high-speed scanning setup.
9. **Business Reports**: Daily summaries, GSTR reports, and profit analysis.
10. **Keyboard Shortcuts**: Power-user guide for zero-mouse operations.
11. **Data Safety**: Manual/Auto-backups and Google Drive cloud sync.

## Technical Implementation

- **Data Driven**: Content is served via internationalization (`i18n`) JSON files, allowing for easy updates and additional language support.
- **Layout**: Uses a dedicated `KnowledgeHubPage.tsx` with a responsive sidebar and data-dense article view.
- **UI Patterns**: Follows the "Card-style" product standards to ensure visual consistency with the rest of the POS system.
