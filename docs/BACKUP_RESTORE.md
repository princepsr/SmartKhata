# Backup & Restore Architecture

## Overview

SmartKhata implements a robust, offline-first Backup & Restore system to ensure data safety. Backups are stored as ZIP archives containing the database, application settings, and metadata.

---

## 🏗️ Core Components

### 1. `BackupService` (`src/main/services/backup-service.ts`)

- **Responsibilities**:
  - Creating ZIP-based backups.
  - Validating backup integrity (`PRAGMA integrity_check`).
  - Orchestrating atomic restoration.
  - Managing folder selection via `dialog`.
- **Format**: `.zip` file containing:
  - `data.db`: SQLite database.
  - `settings.json`: Application settings export.
  - `meta.json`: Versioning and shop metadata.

### 2. `IPC Handlers` (`src/main/ipc-handlers/system-handlers.ts`)

- `system:backup`: Triggers the backup creation flow.
- `system:restore`: Triggers the restoration flow with risk confirmation.
- `system:restart`: Relaunches the app after successful restoration.

---

## 🔄 Backup Process

1. **User Request**: User clicks "Create Backup" in Settings.
2. **Path Selection**: Main process opens a directory picker.
3. **Extraction**: Service reads current `settings` and `database` path.
4. **Packaging**: `adm-zip` bundles files into `smartkhata-backup-[timestamp].zip`.
5. **Confirmation**: IPC returns success to the UI.

---

## 🔥 Restore Process (Atomic & Safe)

The restoration process is designed to be "all-or-nothing" to prevent data corruption.

1. **Validation**:
   - Checks if ZIP is valid.
   - Verifies `schemaVersion` compatibility.
   - Runs SQLite integrity checks on the extracted database.
2. **Atomic Swap**:
   - Moves current `data.db` to `data.db.old`.
   - Moves new database into place.
   - If anything fails, it moves `data.db.old` back immediately (Rollback).
3. **Settings Restoration**: Updates the internal settings store from `settings.json`.
4. **App Relaunch**: The application must restart to initialize the new database state.

---

## 📋 Backup Metadata (`meta.json`)

```json
{
  "appName": "SmartKhata",
  "version": "0.1.0",
  "timestamp": "2026-02-11T...",
  "shopName": "My Kirana Store",
  "schemaVersion": 3
}
```

---

## ⚡ Integration

- **Settings Integration**: Located in the **Data Management** tab of the Settings module.
- **Pre-check**: Restoration requires user confirmation via a high-risk modal.

---

**Last updated:** 2026-02-11  
**Version:** 1.0
