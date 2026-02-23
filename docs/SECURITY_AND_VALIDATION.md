# Security & Validation

SmartKhata POS implements a rigid security and validation layer to ensure data integrity and system stability across the Electron IPC boundary.

---

## 🛡️ The IPCHandler Middleware

All backend entry points are wrapped in the `IPCHandler.handle` utility. This provides a standardized "middleware" flow for every request:

1.  **Request Logging**: Captures channel and payload (sanitized) with a unique Request ID.
2.  **Schema Validation**: Uses Zod to validate structure before logic executes.
3.  **Timeout Guard**: Automatically rejects any operation taking longer than **30 seconds**.
4.  **Error Sanitization**: Prevents leaking sensitive Node.js stack traces to the UI.
5.  **Logging**: records execution time and SUCCESS/FAILURE status.

---

## ✅ Schema Validation (Zod)

Validation rules are centralized in `src/shared/validation/schemas.ts`. This allows the same rules to be enforced on both the client (for immediate feedback) and the server (for security).

### Key Constraints:

- **Products**: SKU uniqueness is checked at the repository level, but structure (length, numeric ranges) is checked via Zod.
- **Billing**: Item quantities must be whole numbers, and discounts cannot exceed the bill value (or 100% depending on context).
- **Customers**: Phone numbers are strictly validated as 10-digit strings.

---

## 🔒 Error Handling Flow

The system distinguishes between **expected errors** (e.g., `InsufficientStockError`) and **system failures**:

- **Expected Errors**: Converted to user-friendly messages and returned with `success: false`.
- **System Failures**: Logged to disk with full stack traces, but the user sees a generic "System Error" message to prevent information leakage.
- **Timeouts**: If a repository query hangs, the `IPCHandler` will abort the request to prevent a UI freeze.

---

## 🛠️ Best Practices for Developers

- **Always use a Schema**: Never register an IPC handler without a corresponding Zod schema.
- **Keep Handlers Thin**: Logic should reside in Services; Handlers should only orchestrate and validate.
- **Sanitize Sensitive Data**: Use `skipLogging: true` for any handler dealing with passwords or sensitive customer data.

---

**Last updated:** 2026-02-23  
**Implementation:** `src/main/ipc/ipc-handler.ts`, `src/shared/validation/schemas.ts`
