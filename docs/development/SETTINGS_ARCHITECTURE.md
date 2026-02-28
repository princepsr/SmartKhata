# Settings Architecture (Reactive Configuration Hub)

SmartKhata uses a centralized, reactive settings architecture that ensures application-wide consistency and zero-latency access to configuration state.

---

## 1. Technical Data Flow

The architecture follows a **Pull-Once, Push-Always** pattern:

1.  **Singleton Lifecycle**: `SettingsService` is initialized as a singleton. On application boot, it performs a full database read of the `app_config` table.
2.  **In-Memory Hot Cache**: The service maintains a `configCache` object. All reads (`getConfig()`) are served directly from RAM to eliminate SQLite I/O overhead on performance-critical paths (e.g., fetching paper size during a sale).
3.  **Event-Driven Updates**: When a setting is changed:
    - The `SettingsRepository` performs an `UPSERT` to persistence.
    - The `SettingsService` updates its local cache.
    - An internal `EventEmitter` triggers a `settings-changed` event.
    - Subscribed services (e.g., `PrintService`, `UpdateService`) automatically re-configure themselves without a restart.

---

## 2. Validation & Sanity Constraints

`SettingsService` enforces 15+ strict validation rules to prevent corrupt or illegal states:

| Category | Validation Rule | Impact |
|----------|-----------------|--------|
| **Branding** | Shop Name cannot be empty; Footer < 200 chars. | UI Integrity |
| **Contact** | Phone must be exactly 10 digits (sanitized). | Receipt Formatting |
| **Taxation** | GSTIN must be 15 alphanumeric chars; State Code must be 2 digits. | Legal Compliance |
| **Printing** | Paper Size must be `58mm` or `80mm`; Copies 1-5. | Driver Stability |
| **Supply** | Type must be `intrastate` or `interstate`. | Tax Calculation |
| **Updates** | `autoUpdateEnabled` must be boolean. | System Logic |
| **Backup** | Interval 1-30 days OR 1-24 hours; Retain count 1-50. | Data Safety |

---

## 3. Storage Model (Key-Value Upsert)

Settings are stored in the `app_config` table as a schema-less key-value store. This allows adding new features (like Cloud Sync or OCR) without requiring SQL migrations.

- **Primary Key**: `key` (TEXT).
- **Value**: `value` (TEXT) - Complex objects are JSON-stringified before storage.
- **Concurrency**: Handled via standard SQLite atomic writes.

---

## 4. UI Synchronization (Zustand & IPC)

1.  **Hydration**: On UI mount, the `useAppSettingsStore` invokes `window.electron.settings.getSettings()`.
2.  **Reactive UI**: The store makes settings available as reactive hooks (e.g., `const theme = useSettings(s => s.theme)`).
3.  **Writes**: When the user clicks "Save" in the Settings UI, the IPC bridge sends the partial update to the Main process, which then triggers the event-driven update cycle described in Section 1.

---

## 5. System Diagnostics (Debug Tab)

The **System Debug** tab provides a real-time window into the internal state:
- **IPC Latency**: Current response times for service calls.
- **Database Path**: Physical location of the SQLite file.
- **Stability Metrics**: Current memory usage and cleanup status.
- **Maintainance**: Direct button to open `UserData` folder or run `SQLite Integrity Check`.

---

## Technical Reference
- **Main Service**: `src/main/services/settings-service.ts`
- **Repository**: `src/main/repositories/settings-repository.ts`
- **UI Page**: `src/renderer/pages/SettingsPage.tsx`
- **State Store**: `src/renderer/store/useAppSettingsStore.ts`
