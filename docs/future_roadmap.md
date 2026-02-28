# SmartKhata Future Enhancements Roadmap

This document outlines high-impact ideas for future releases of SmartKhata to improve customer engagement, multi-device access, and hardware integrations.

## 1. Customer Engagement & Loyalty

- **WhatsApp Digital Receipts (Auto-Bill)**: Automatically send a digital PDF receipt to the customer's WhatsApp number when their bill is generated.
- **Points / Loyalty System**: Automatically track return customers by phone number and allow the shopkeeper to offer points or specialized discounts to their "VIP" customers.

## 2. Multi-device & Role-Based Access (RBAC)

- **Staff Profiles (Cashier vs. Owner)**: Implement a simple PIN-based login screen. Cashiers can only access the billing screen, while owners can access cost-prices, analytics, and settings.
- **Local Network Sync**: Allow multiple PCs in the same shop (e.g., two checkout counters) to connect to the same local database.

## 3. Hardware Integrations

- **Customer Facing Display (CFD)**: Support for a secondary monitor facing the customer that shows the live cart as items are scanned, and then displays the QR code for payment at the end.
- **Cash Drawer Kicker**: Sending a specific ESC/POS signal to automatically pop open the physical cash drawer when a "Cash" bill is finalized.

## 4. Smarter Insights (Predictive Analytics)

- **Smart Restock Alerts**: Analyze the rate at which items sell and generate predictive "Purchase Orders" (e.g., "You are selling 10 strips of Azithromycin a week, and only have 12 left. Order more now before the weekend").

## 5. Cashier & Shift Management

- **Register Shifts (Day Open/Close)**: Allow shop owners to track the cash drawer accurately. The cashier enters the "Opening Balance" in the morning and "Closing Balance" at night. The system calculates expected cash based on daily sales to highlight any discrepancies or missing money.

## 6. Cloud & Sync

- **Local Network Sync (Multi-Counter)**: Allowing multiple computers on the same Wi-Fi network to connect to a single "Master" computer's SQLite database, enabling larger stores to have 2 or 3 billing counters running simultaneously.
