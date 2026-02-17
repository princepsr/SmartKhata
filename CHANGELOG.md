# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
