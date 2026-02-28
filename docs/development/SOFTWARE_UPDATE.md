# Software Update Architecture

## Overview

SmartKhata implements an automated software update system using `electron-updater`, integrated with user settings, global state management, and a mandatory "pre-update" data safety backup mechanism.

---

## 🏗️ Core Components

### 1. `UpdateService` (`src/main/services/update-service.ts`)

The main process controller for the update lifecycle.

- **Auto-Check**: Checks for updates on startup if `autoUpdateEnabled` is set to `true` (production only).
- **Safety Backup**: Created automatically in `installUpdate()` before the application restarts.
- **Simulated Mode**: In development, simulates update status transitions to verify UI behavior.
- **Event Listeners**: Monitors `electron-updater` events (`checking-for-update`, `update-available`, `update-not-available`, `download-progress`, `update-downloaded`, `error`).

### 2. `useUpdateStore` (`src/renderer/store/useUpdateStore.ts`)

The frontend state manager using Zustand.

- **Global Status**: Maintains `UpdateStatus` (IDLE, CHECKING, AVAILABLE, DOWNLOADING, DOWNLOADED, ERROR).
- **Connectivity Guards**: Verifies internet connection before triggering checks or downloads using the main process `SYSTEM_CHECK_CONNECTIVITY` channel.
- **IPC Integration**: Listens for status updates from the main process and provides actions to trigger updates.

### 3. `UpdateBanner.tsx` (`src/renderer/components/layout/UpdateBanner.tsx`)

A global UI component placed in the main `Layout`.

- **Visibility**: Automatically appears when an update is available or being processed.
- **Time Formatting**: Uses `Intl.DateTimeFormat` with the `Asia/Kolkata` time zone to show IST timestamps for update availability.

---

## 🛡️ Data Safety Mechanism (Pre-Update Backup)

To ensure that a software update never results in data loss, the system performs a mandatory safety backup before applying the update.

- **Trigger**: Automatically called inside `updateService.installUpdate()`.
- **Payload**: Includes the latest SQLite database, application settings, and metadata.
- **Location**: `<userData>/safety-backups/`.
- **Retention**: Keeps the **last 3** safety backups to optimize space while ensuring roll-back capability.
- **Resilience**: If a backup fails (e.g., disk full), the update proceeds since the primary data in `userData` is preserved by Electron's update process, but a warning is logged.

---

## ⚙️ Configuration

Users can control the update behavior in **Settings > System Debug**:

- **Automatic Updates**: Toggles whether the app checks for updates on every startup.
- **Persistence**: Stored in the `app_config` table as `auto_update_enabled`.

---

## 🛠️ Developer Testing

### Simulating Update States

In development mode, calling `checkForUpdates` simulates the following sequence:

1. `CHECKING`
2. `NOT_AVAILABLE` (or `AVAILABLE` if configured for UI testing)

### Testing Infrastructure

- **Main Tests**: `tests/services/update-service.test.ts`
- **Persistence Tests**: `tests/services/settings-persistence.test.ts`
- **Store Tests**: `tests/unit/update-store.test.ts`

---

## 🚀 Automated Release Process

To simplify publishing new versions to GitHub, a dedicated release script is provided.

- **Command**: `pnpm release <version>` (e.g., `pnpm release 1.0.1`)
- **Workflow**:
  1. **Pre-flight Checks**: Runs `lint`, `type-check`, and all unit tests.
  2. **Version Bump**: Updates `version` in `package.json`.
  3. **Git Commit**: Commits the version change with a standard message.
  4. **Tagging**: Creates a git tag for the new version.
  5. **Push**: Pushes both the commit and the tag to GitHub.
  6. **CI/CD**: Triggers the `Build/Release` GitHub Action to build and publish the `.exe`.

> [!IMPORTANT]
> Always commit your feature code changes before running the release command. The script only handles the version bump and tagging.

---

## 🔄 Update Lifecycle Flow

1. **Check**: `UpdateService` triggers check (startup or manual).
2. **Found**: `update-available` event is fired; `UpdateBanner` appears.
3. **Download**: User clicks "Download"; `UpdateService` handles the stream.
4. **Ready**: `update-downloaded` event is fired.
5. **Install**: User clicks "Update & Restart":
   - `UpdateService` creates a safety backup.
   - `autoUpdater.quitAndInstall()` is called.
   - App restarts with the new version.

---

**Last updated:** 2026-02-25  
**Version:** 1.0 (Initial Documentation)
