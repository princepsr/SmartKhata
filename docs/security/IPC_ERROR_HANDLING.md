# Global IPC Error Handling

## Overview

The Global IPC Error Handling system ensures that all errors occurring within the IPC layer are:
1.  **Caught** - preventing application crashes.
2.  **Logged** - with full technical details (stack traces) in main process logs.
3.  **Sanitized** - preventing sensitive info/stack traces from leaking to the renderer.
4.  **Propagated** - returned to the renderer in a standard, user-friendly format.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Renderer Process                        │
│                                                              │
│  await window.api.invoke('channel', data)                   │
│         ▲                                                    │
│         │ { success: false, error: "Friendly Message" }      │
└─────────┼────────────────────────────────────────────────────┘
          │
┌─────────▼────────────────────────────────────────────────────┐
│                      Main Process                            │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               IPCHandler (Wrapper)                    │  │
│  │                                                       │  │
│  │  try {                                                │  │
│  │     // Validate & Execute                             │  │
│  │     await handler(request)                            │  │
│  │  } catch (err) {                                      │  │
│  │     // 1. Log technical error (Stack Trace)           │  │
│  │     logIPCError(channel, err);                        │  │
│  │                                                       │  │
│  │     // 2. Sanitize for user                           │  │
│  │     const msg = sanitizeIPCError(err);                │  │
│  │                                                       │  │
│  │     // 3. Return safe response                        │  │
│  │     return { success: false, error: msg };            │  │
│  │  }                                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Response Format

All IPC calls return a standard response object:

```typescript
interface IPCResponse<T> {
  success: boolean;
  data?: T;          // Present if success: true
  error?: string;    // Present if success: false
}
```

**Example Error Response:**
```json
{
  "success": false,
  "error": "Product name is required"
}
```

---

## Error Categories & Sanitization

The `sanitizeIPCError` utility (`src/main/ipc/error-utils.ts`) transforms complex error objects into safe strings.

| Error Source | Handling | Example Output |
| :--- | :--- | :--- |
| **Zod Validation** | Extract first issue message | `"Price must be positive"` |
| **System Error** | Message only (no stack) | `"Database connection failed"` |
| **Custom IPCError** | Message pass-through | `"Product not found"` |
| **Unknown/Crash** | Generic fallback | `"An unexpected error occurred"` |

### ❌ What is HIDDEN from Renderer (Sanitized)
- Stack traces (`at Object.handler ...`)
- Internal file paths (`C:\Users\Prince...`)
- Database connection strings or raw SQL errors
- Environment variables

### ✅ What is SHOWN to Renderer
- Validation messages (`Invalid email format`)
- Business logic errors (`Insufficient stock`)
- Resource not found messages (`Customer #123 not found`)

---

## Logging Strategy

While the renderer gets a sanitized message, the **Main Process Logs** (`dev-data/logs/main.log`) contain the full picture for debugging.

**Log Entry Example:**
```json
[ERROR] IPC Error: product:create {
  "requestId": "1707350400000-abc",
  "channel": "product:create",
  "message": "SQLITE_CONSTRAINT: UNIQUE constraint failed: products.sku",
  "stack": "Error: ... at Database.prepare ...",
  "duration": "15ms"
}
```

---

## Best Practices for Handlers

### 1. Throw Standard Errors
Just throw an error, and the wrapper handles the rest.

```typescript
throw new Error('Customer not found');
```

### 2. Throw Zod Errors (Implicit)
When using the `schema` option, Zod errors are automatically thrown and caught.

### 3. Async Safety
Always use `async/await` inside handlers. The wrapper catches rejected promises.

```typescript
// ✅ Good
async (req) => {
  await db.query(...); 
}

// ❌ Bad (Unhandled Rejection risk)
(req) => {
  db.query(...).then(...); // If this fails and isn't returned, process may crash!
}
```

### 4. Custom Error Types
Use `IPCError` for typed errors if needed (future extension).

---

## Global Process Safety

In addition to IPC-specific handling, the application has global safety guards (`src/main/utils/error-handler.ts`):

- **`uncaughtException`**: Logs error and shows "Unexpected Error" dialog.
- **`unhandledRejection`**: Logs error and shows "Promise Error" dialog.

This ensures that even if an error escapes the IPC layer (extremely rare), the application handles it gracefully without a silent crash.

---

**Files:**
- `src/main/ipc/ipc-handler.ts` - Main wrapper
- `src/main/ipc/error-utils.ts` - Sanitization & logging logic
- `docs/IPC_ERROR_HANDLING.md` - This documentation
