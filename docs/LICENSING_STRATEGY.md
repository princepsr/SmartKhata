# Licensing Strategy

This document defines the rules and behavior for the SmartKhata Licensing & Trial system.

## 1. Trial Rules

The trial is designed to give users a full experience while creating a natural conversion point.

| Rule            | Value           | Description                                 |
| :-------------- | :-------------- | :------------------------------------------ |
| **Duration**    | 30 Days         | From the first time the app is launched.    |
| **Usage Limit** | 300 Bills       | Total lifetime bills created in the system. |
| **Trigger**     | Whichever first | Trial expires if _either_ limit is reached. |

## 2. Expiry Behavior (Polite Locking)

Once the trial or paid license expires, the app remains functional but restricted.

> [!IMPORTANT]
> **Golden Rule**: Never enough to uninstall, just enough to convert.

- **ALLOWED (Read-Only)**:
  - View all previous bills and customer history.
  - View Sales Reports (Daily, GST, etc.).
  - Backup and Export data (Excel/PDF).
  - Search inventory.
- **RESTRICTED (Locked)**:
  - Creating new Bills (Save/Print).
  - Adding or editing Products/Inventory.
  - Adding new Customers.

## 3. Implementation Details

### 3.1 Device Fingerprinting

To ensure the license is bound to a single PC without collecting personal data, we use a multi-factor hardware hash.

**Generation Strategy**:

1.  **CPU Info**: Model string + logical core count.
2.  **Storage ID**: Serial number of the primary physical disk drive.
3.  **Memory Profile**: Total system memory.
4.  **OS Profile**: Platform and architecture.

### 3.2 License Binding & Activation

- **Single PC**: License is bound to the `System ID` generated from hardware identifiers.
- **Offline Activation**: Uses a signed, 12-character "Short Key" format (`KRN-XXXX-XXXX-XXXX`) that is self-contained and requires no internet for verification.
- **Admin Tool**: See [ADMIN_KEY_GENERATION.md](file:///C:/Users/PrinceSingh/Sciforma/SmartKhata/docs/ADMIN_KEY_GENERATION.md) for usage of the internal `generate-key.js` script.

## 4. Edge Cases & Anti-Tamper

- **System Clock Manipulation**: Monitoring `last_run_date` to prevent clock rollbacks.
- **Database Deletion**: A hidden marker file in `%APPDATA%` persists the trial start date even if the database is deleted.
- **Hardware Upgrade**: Built-in tolerance for RAM upgrades while strictly binding to CPU/Disk.

## 5. UI & UX Principles

- **Polite Banners**: Non-threatening messaging that escalates as expiry approaches.
- **Grace Period**: A 3-day buffer after formal expiry before hard locks are applied.
- **Transparency**: Clear display of System ID for easy administrative activation.
