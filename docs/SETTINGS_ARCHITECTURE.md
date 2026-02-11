# Settings Architecture & UI Pattern

## Overview

The Settings module in SmartKhata follows a high-density, tabbed navigation pattern designed for efficient application configuration and system diagnostics. It mirrors the "Rich App" aesthetic established in the Reporting module.

---

## 🏗️ Structure

### 1. Multi-Row Header Architecture

To maintain visual consistency with the `ReportsPage`, the Settings module uses a two-container header system:

- **Row 1: Main Header (`.settings-header`)**: Contains the Page Title (`Shop Settings`) and a context-aware Subtitle.
- **Row 2: Tab Toolbar (`.settings-toolbar`)**: Houses the segmented navigation controls. This separation creates a professional layered effect with independent borders and shadows.

### 2. Tab Navigation

The module is divided into four functional areas:

- **Shop Info**: Store profile, contact details, and branding.
- **Inventory**: Stock alert thresholds and management rules.
- **Data Management**: Backup, Restore, and Reset operations.
- **System Debug**: Real-time IPC diagnostics and database status.

---

## 🎨 Design Patterns

### Scoped Styling

All Settings-specific styles are restricted to the `.settings-page` container. This ensures that layout rules (like full-width expansion or form-grid spacing) do not leak into other modules.

### Component Standardization

- **Forms**: Use a two-column grid (`.settings-form`) with standardized `form-input` height and `0.5rem` radius.
- **Cards**: Each configuration block is wrapped in a `.settings-section-card` with a subtle left-accent border.
- **Buttons**: Reuses the core `btn-primary` and `btn-secondary` classes but scoped for specific Settings spacing.

### Diagnostics (System Debug)

The Debug tab uses a specific row-based grid system for displaying technical metadata, using:

- `.debug-data-grid`: A high-density grid for key-value info.
- `.debug-alert`: Specialized status containers for diagnostic results.

---

## 🔄 Integration

- **State Management**: Uses `useAppSettingsStore` (Zustand) for reactive configuration updates.
- **IPC Wiring**: Connects to `SettingsService` for persistence and `BackupService` for data lifecycle operations.

---

**Last updated:** 2026-02-11  
**Version:** 1.0
