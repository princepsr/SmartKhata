# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-02-23

### Added

- **Immersive Reporting UI**:
  - Implemented custom, professional-themed `RichTooltip` components with detailed analytics metadata.
  - Added a dedicated **Revenue** summary card to the GST tab for better financial visibility.
- **Improved Analytics Context**: Tooltips now provide clear explanations for Gross Sales, Revenue, and Estimated Profit.

### Fixed

- **GST-Aware Profit Calculation**: Fixed a bug where GST was incorrectly subtracted from profit on non-GST bills.
- **Reporting Accuracy**: Standardized subtotal-based profit derivation to ensure consistency with tax-reporting rules.
- **UI Polishing**: Removed redundant browser-default tooltips and refined interactive hover states.

## [1.1.0] - 2026-02-22

### Added

- **Command Center Enhancements**:
  - Integrated high-frequency actions (Add Product/Customer, View Reports).
  - Deep linking for Settings (Shop, Printer, Data) and Billing (Clear Cart, History).
- **IST/Local Time Alignment**:
  - Unified date handling across Repositories and License Service to use local time.
  - Resolved 5.5-hour reporting shift issues.

### Fixed

- Resolved `ReportsPage` import errors and missing `useSearchParams`.
- Fixed license expiry banner day-boundary alignment.

## [1.0.0] - 2026-02-18

### Added

- **Core POS**: Product CRUD, category-based stock alerts, and barcode support.
- **Billing**: High-speed billing with virtual barcode scanner integration, UPI/Cash payments, and multi-buy discounts.
- **Reporting**: Daily sales, GST slab-wise reporting, and trend analytics (Day/Week/Month).
- **Hardened Data Layer**: SQLite WAL-mode, atomic transactions, and automated migrations.
- **Thermal Printing**: Professional 58mm & 80mm receipt engine with hidden window pooling for zero-lag printing.
- **Distribution**: Branded Windows NSIS installer and portable executables.
- **Security**: Hardware-bound machine licensing, anti-time-tamper clock protection, and offline activation.
- **Maintenance**: Structured PII-sanitized logging, automated backups, and versioned distribution.
- **Quality Gates**: Release check automation (`pnpm release:check`).

### Fixed

- Resolved `BackupService` state persistence issues.
- Fixed `BaseRepository` stale connection management.
- Hardened IPC communication with Zod schema validation.

### Changed

- Shifted to official **SmartKhata** production branding.
- Unified settings hub with Shop Profile, Printing, and Licensing management.

---

[1.0.0]: https://github.com/princepsr/SmartKhata/releases/tag/v1.0.0
