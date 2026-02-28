# Placeholder Screens

## Overview

SmartKhata has 5 placeholder screens ready for screenshot and demonstration purposes. All screens follow a consistent layout with clear navigation and feature descriptions.

---

## Screen Structure

Each placeholder screen follows this pattern:

```
┌─────────────────────────────────────┐
│  Page Header                        │
│  - Title                            │
│  - Subtitle                         │
├─────────────────────────────────────┤
│  Page Content                       │
│  ┌───────────────────────────────┐ │
│  │  Placeholder Card             │ │
│  │  - Icon                       │ │
│  │  - Title                      │ │
│  │  - Description                │ │
│  │  - Feature List               │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 1. Billing Page (F2)

**File:** `src/renderer/pages/BillingPage.tsx`

**Route:** `/billing` (default page)

**Purpose:** Main POS billing interface

**Features Listed:**
- Barcode scanning
- Product search
- Cart management
- Payment processing
- Receipt printing

**Visual:**
```
💳
Billing Interface
POS billing screen will be implemented here

• Barcode scanning
• Product search
• Cart management
• Payment processing
• Receipt printing
```

---

## 2. Products Page (F3)

**File:** `src/renderer/pages/ProductsPage.tsx`

**Route:** `/products`

**Purpose:** Product inventory management

**Features Listed:**
- Product list with search
- Add/edit products
- Stock management
- Pricing and discounts
- Categories

**Visual:**
```
📦
Product Management
Product inventory screen will be implemented here

• Product list with search
• Add/edit products
• Stock management
• Pricing and discounts
• Categories
```

**Note:** This page has been enhanced with IPC wrapper example code

---

## 3. Customers Page (F4)

**File:** `src/renderer/pages/CustomersPage.tsx`

**Route:** `/customers`

**Purpose:** Customer database management

**Features Listed:**
- Customer list with search
- Add/edit customer details
- Purchase history
- Credit management
- Contact information

**Visual:**
```
👥
Customer Management
Customer database screen will be implemented here

• Customer list with search
• Add/edit customer details
• Purchase history
• Credit management
• Contact information
```

---

## 4. Reports Page (F5)

**File:** `src/renderer/pages/ReportsPage.tsx`

**Route:** `/reports`

**Purpose:** Sales analytics and reports

**Features Listed:**
- Daily/monthly sales reports
- Product performance
- Profit analysis
- Stock alerts
- Export to PDF/Excel

**Visual:**
```
📊
Reports & Analytics
Reports dashboard will be implemented here

• Daily/monthly sales reports
• Product performance
• Profit analysis
• Stock alerts
• Export to PDF/Excel
```

---

## 5. Settings Page (F6)

**File:** `src/renderer/pages/SettingsPage.tsx`

**Route:** `/settings`

**Purpose:** Application configuration

**Features Implemented:**
- Shop name (text input)
- Shop address (textarea)
- Tax rate (number input)
- Currency symbol (text input)
- Receipt footer (text input)
- Save/Reset buttons

**Visual:**
```
⚙️
Settings
Configure application

Shop Information
┌─────────────────────────┐
│ Shop Name: [          ] │
│ Shop Address: [       ] │
│ Tax Rate (%): [       ] │
│ Currency: [₹]           │
│ Receipt Footer: [     ] │
│                         │
│ [Save] [Reset]          │
└─────────────────────────┘
```

**Note:** This page is fully functional with Zustand state management

---

## Shared Styles

**File:** `src/renderer/pages/BillingPage.css`

All pages share common CSS classes:

### Page Container
```css
.page {
  padding: var(--spacing-xl);
  height: 100%;
  overflow-y: auto;
}
```

### Page Header
```css
.page-header {
  margin-bottom: var(--spacing-xl);
}

.page-title {
  font-size: var(--font-size-2xl);
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.page-subtitle {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
}
```

### Placeholder Card
```css
.placeholder-card {
  background-color: var(--color-bg);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: var(--spacing-lg);
}
```

### Feature List
```css
.feature-list {
  text-align: left;
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
}

.feature-list li {
  margin-bottom: var(--spacing-sm);
}
```

---

## Navigation Integration

All screens are integrated with:

1. **Sidebar Navigation** (always visible)
   - Active route highlighted
   - Keyboard shortcuts shown (F2-F6)

2. **React Router**
   - Client-side routing
   - No page reloads

3. **Error Boundary**
   - Catches component errors
   - Shows fallback UI

4. **Global Messages**
   - Loading overlay
   - Error/success toasts

---

## Screenshot Checklist

To take screenshots of each page:

### 1. Start Dev Server
```bash
pnpm dev
```

### 2. Navigate to Each Page
- Press `F2` for Billing
- Press `F3` for Products
- Press `F4` for Customers
- Press `F5` for Reports
- Press `F6` for Settings

### 3. Screenshot Areas
- **Full window** - Shows sidebar + content
- **Content only** - Shows page without sidebar
- **Active navigation** - Shows highlighted nav item

---

## Page Status

| Page | Route | Shortcut | Status | Notes |
|------|-------|----------|--------|-------|
| **Billing** | `/billing` | F2 | Placeholder | Feature list only |
| **Products** | `/products` | F3 | Enhanced | IPC example code |
| **Customers** | `/customers` | F4 | Placeholder | Feature list only |
| **Reports** | `/reports` | F5 | Placeholder | Feature list only |
| **Settings** | `/settings` | F6 | Functional | Zustand integration |

---

## Customization

### Adding More Features to Placeholder

```typescript
<ul className="feature-list">
  <li>Existing feature</li>
  <li>New feature</li>  {/* Add here */}
</ul>
```

### Changing Placeholder Icon

```typescript
<div className="placeholder-icon">🎯</div>  {/* Change emoji */}
```

### Updating Description

```typescript
<p>Your custom description here</p>
```

---

## Next Steps

To convert placeholders to real screens:

1. **Remove placeholder card**
2. **Add real UI components**
3. **Connect to IPC/stores**
4. **Add business logic**

**Example:**
```typescript
// Before (Placeholder)
<div className="placeholder-card">
  <div className="placeholder-icon">💳</div>
  <h2>Billing Interface</h2>
  <p>Coming soon...</p>
</div>

// After (Real)
<div className="billing-container">
  <ProductSearch />
  <Cart />
  <PaymentForm />
</div>
```

---

## Summary

✅ **5 placeholder screens created**  
✅ **Consistent layout and styling**  
✅ **Integrated with routing**  
✅ **Keyboard shortcuts working**  
✅ **Screenshot-ready**  
✅ **Settings page fully functional**  

**All screens are ready for demonstration and screenshots!**

---

**Last updated:** 2026-02-08  
**Files:** `src/renderer/pages/*.tsx`
