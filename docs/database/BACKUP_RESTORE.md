# Backup & Restore Architecture

## Overview

SmartKhata implements a robust, offline-first Backup & Restore system to ensure data safety. Backups are stored as ZIP archives containing the database, application settings, and metadata.

---

## 🏗️ Core Components

### 1. `BackupService` (`src/main/services/backup-service.ts`)

- **Responsibilities**:
  1.  Creating ZIP-based backups.
  2.  **Automated Backups**: Configurable daily backups with rotation.
  3.  **Cloud Sync**: Optional synchronization of automated backups to Google Drive.
  4.  **Restore**: Atomic restoration from any valid .zip backup file (local or cloud).
- **Format**: `.zip` file containing:
  - `data.db`: SQLite database.
  - `settings.json`: Application settings export.
  - `meta.json`: Versioning and shop metadata.

### 2. `IPC Handlers` (`src/main/ipc-handlers/system-handlers.ts`)

- `system:backup`: Triggers the backup creation flow.
- `system:restore`: Triggers the restoration flow with risk confirmation.
- `system:restart`: Relaunches the app after successful restoration.

### 3. `AutoBackupService` (`src/main/services/auto-backup-service.ts`)

- **Responsibilities**:
  - Background monitoring of backup intervals (checks every 15 minutes and immediately upon settings changes).
  - Automated "silent" backups on a configurable interval (1-24 hours or 1-30 days).
  - **Rotation Policy**: Maintains a user-configurable number of backups (1-50) to optimize disk space.
  - Storage Location: `<userData>/autobackups/`.
  - Updates `lastAutoBackup` timestamp.
  - If authenticated with Google, triggers `GoogleDriveService.syncBackup()` and monitors for connectivity changes to retry failed syncs.

3.  **Pre-Update Safety Backup**:

- Automatically triggered by `UpdateService.installUpdate()` before the application restarts to apply a software update.
- Storage Location: `<userData>/safety-backups/`.
- Retention Policy: Maintains the last 3 pre-update backups.

### Cloud Synchronization & Restore (`GoogleDriveService`)

The `GoogleDriveService` manages the cloud persistence layer:

- **Single File Policy**: Updates a single `SmartKhata_Auto_Backup.zip` file on Drive to avoid cluttered storage.
- **OAuth2 Flow**: Secure authentication using `google-auth-library`.
- **Cloud Restore**:
  - Retrieves metadata (size, modification date) from Drive before restore.
  - Downloads the backup to a temporary directory.
  - Triggers the standard `BackupService.restore()` logic using the temp file.
- **Token Security**: OAuth tokens are encrypted and stored locally using Electron's `safeStorage`.
- **Offline Resilience**: If no internet is available, local backups still complete; cloud sync resumes during the next cycle when connectivity is restored.

---

## 🛠️ Google Cloud Setup Guide

To enable Google Drive integration, you must provide your own OAuth 2.0 credentials in the `.env` file:

1.  **Create a Project**: Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2.  **Enable APIs**: Enable the **Google Drive API** and **Google People API** for your project.
3.  **Configure OAuth Consent Screen**:
    - Select "External" User Type.
    - Add the scope: `.../auth/drive.file`.
    - Add your email as a Test User (since the app is in "Testing" mode).
4.  **Create Credentials**:
    - Go to "Credentials" -> "Create Credentials" -> "OAuth client ID".
    - Application type: **Web application** (required for the local redirect flow).
    - Authorized Redirect URIs: `http://localhost:8888/oauth2callback` (Port 8888 is used to avoid conflicts).
5.  **Update `.env`**:
    - Copy your **Client ID** and **Client Secret**.
    - Add them to your `.env` file:
      ```env
      GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
      GOOGLE_CLIENT_SECRET=your-client-secret
      ```

---

## 🚀 Production Deployment & Costs

### 1. Is it a paid service?

**No.** For most small to medium applications, using the Google Drive API is **completely free**:

- **API Usage**: Google provides a generous free tier for API requests (millions of requests per day).
- **Storage**: The backup files are stored in the **user's own Google Drive**. It uses their storage space (15GB free tier), not yours. You don't have to pay for their storage.
- **Developer Cost**: Creating a project in Google Cloud Console and obtaining OAuth credentials is free.

### 2. OAuth Verification (For Public Release)

While it's free, Google requires a "Verification" process if you want to remove the "This app is unverified" warning for your users:

- **Scope**: We use the `drive.file` scope. This is considered a **Sensitive Scope** (but not "Restricted").
- **Requirements**: You will need to provide a Privacy Policy URL and optionally a YouTube video showing how the app uses Google Drive.
- **Testing Mode**: During development, your app is in "Testing" mode. You must manually add "Test Users" (your own email addresses) in the Google Console to allow them to log in.

### 3. Native Integration

SmartKhata uses an internal `BrowserWindow` for the login flow. This ensures your users never have to leave the app to link their account, providing a premium experience out of the box.

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

**Last updated:** 2026-02-25  
**Version:** 1.3 (Added Pre-Update Safety Backups)
