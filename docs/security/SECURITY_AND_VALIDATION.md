# Security & Validation (Defense-in-Depth)

SmartKhata implements a professional "Defense-in-Depth" security model to protect local data, prevent system corruption, and ensure a stable POS experience in offline retail environments.

---

## 1. IPC Boundary & Whitelisting

SmartKhata enforces a strict "Whitelisted-Only" communication policy between the untrusted Renderer (UI) and the trusted Main (System).

- **Channel Registry**: Every valid IPC operation is defined in `src/shared/ipc/channels.ts`. 
- **Enforcement**: The Preload script uses `isValidChannel()` to verify every request. Any attempt to send a message on an unregistered channel is blocked at the context boundary before reaching the Main process.
- **Context Isolation**: Enabled (`contextIsolation: true`). The Renderer cannot access the `ipcRenderer` directly and must use the whitelisted methods exposed via `window.electron.*`.

---

## 2. SQL Injection Prevention

The application effectively eliminates SQL injection risks through structural enforcement in the `BaseRepository`.

- **Parameterized Queries**: Every repository operation (Insert, Update, Delete) uses `better-sqlite3`'s prepared statements:
  ```typescript
  // ✅ ENFORCED PATTERN
  const stmt = this.db.prepare(sql);
  const result = stmt.run(...params);
  ```
- **Constraint Mapping**: Raw SQLite errors are intercepted by a centralized `handleError` logic which maps technical codes (e.g., `SQLITE_CONSTRAINT_UNIQUE`) to safe, high-level `DatabaseError` objects.

---

## 3. Structural Validation (Zod)

Validation is performed at the IPC entry point to prevent "Garbage-In" data from reaching the service layer.

- **Centralized Schemas**: Rules (e.g., Phone must be 10 digits, SKU > 3 chars) are defined in `src/shared/validation/schemas.ts`.
- **Cross-Process Enforcement**:
  - **Renderer**: Uses schemas for immediate UI red-border feedback.
  - **Main**: The `IPCHandler` middleware performs a second, authoritative `safeParse` on the data. If the structural check fails, the request is rejected with a `400 Bad Request` equivalent before any business logic executes.

---

## 4. Input Normalization & Sanity

To ensure data consistency, all inputs undergo normalization:
- **Trimming**: All string fields are whitespace-trimmed during validation.
- **Date Normalization**: The `parseDate` helper forces SQLite's `localtime` strings into a stable IST-mapped JavaScript `Date` object to prevent offset drift.
- **Status Guards**: Repositories check `isActive` flags before allowing mutations on products or customers, preventing accidental billing against deleted entities.

---

## 5. Security Checklist

| Feature | Implementation | Outcome |
|---------|----------------|---------|
| **XSS Protection** | `nodeIntegration: false`, `CSP` | Blocks malicious scripts from accessing the OS. |
| **SQL Injection** | Parameterized Queries | Prevents data theft/corruption via input. |
| **Data Leakage** | PII Redaction in Logs | Ensures customer names/phones stay in the encrypted DB. |
| **Tamper Protection** | JS Obfuscation | Makes reverse-engineering and trial-resetting difficult. |
| **Access Control** | License & Expiry Guards | Blocks key POS actions once the trial expires. |

---

## Technical Reference
- **IPC Gateway**: `src/main/ipc/ipc-handler.ts`
- **Validation Core**: `src/shared/validation/schemas.ts`
- **Database Base**: `src/main/repositories/base-repository.ts`
