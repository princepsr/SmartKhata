# Global Error Handling

## Overview

SmartKhata implements comprehensive global error handling to catch all uncaught exceptions and unhandled promise rejections. Errors are logged locally and users are shown friendly crash dialogs without exposing technical stack traces.

---

## Architecture

```
Error occurs
    ↓
Global handler catches it
    ↓
Log error details (with stack trace)
    ↓
Show user-friendly dialog (no stack trace)
    ↓
User chooses: Restart or Close
```

---

## Error Handler Implementation

**File:** `src/main/utils/error-handler.ts`

### Error Types Handled

1. **Uncaught Exceptions**
   - Synchronous errors not caught by try/catch
   - Example: `throw new Error('Something broke')`

2. **Unhandled Promise Rejections**
   - Async errors without `.catch()`
   - Example: `Promise.reject('Failed')`

---

## Error Flow

### 1. Error Occurs

```typescript
// Example: Uncaught exception
function buggyFunction() {
  throw new Error('Database connection failed');
}

buggyFunction();  // Not wrapped in try/catch
```

---

### 2. Global Handler Catches

```typescript
process.on('uncaughtException', (error) => {
  handleUncaughtException(error);
});
```

---

### 3. Error Logged

```typescript
logger.error('=== UNCAUGHT EXCEPTION ===', {
  message: 'Database connection failed',
  stack: 'Error: Database connection failed\n    at buggyFunction...',
  timestamp: '2026-02-08T01:59:03.123Z',
  type: 'uncaughtException'
});
```

**Log file:** `AppData/Roaming/SmartKhata/logs/app-2026-02-08.log`

---

### 4. User-Friendly Dialog Shown

```
┌─────────────────────────────────────────────┐
│  SmartKhata - Unexpected Error              │
├─────────────────────────────────────────────┤
│                                             │
│  An unexpected error occurred and the       │
│  application may need to restart.           │
│                                             │
│  Error: Database connection failed          │
│                                             │
│  Time: 2/8/2026, 1:59:03 AM                │
│                                             │
│  The error has been logged for debugging.   │
│  You can find logs at:                      │
│  C:\Users\...\SmartKhata\logs\              │
│                                             │
│  Would you like to restart the application? │
│                                             │
│  [ Restart ]  [ Close ]                     │
└─────────────────────────────────────────────┘
```

**Key points:**
- ✅ User-friendly message
- ✅ Error message (no stack trace)
- ✅ Timestamp
- ✅ Log location
- ✅ Restart option
- ❌ No technical stack trace

---

## Implementation Details

### Error Formatting

```typescript
interface ErrorDetails {
  message: string;      // User-friendly error message
  stack?: string;       // Full stack trace (for logs only)
  timestamp: string;    // ISO timestamp
  type: 'uncaughtException' | 'unhandledRejection';
}

function formatError(error: Error | any, type: ErrorDetails['type']): ErrorDetails {
  return {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    type,
  };
}
```

---

### Crash Dialog

```typescript
async function showCrashDialog(errorDetails: ErrorDetails): Promise<void> {
  const userMessage = `An unexpected error occurred and the application may need to restart.

Error: ${errorDetails.message}

Time: ${new Date(errorDetails.timestamp).toLocaleString()}

The error has been logged for debugging. You can find logs at:
${logger.getLogsDirectory()}

Would you like to restart the application?`;

  const result = await dialog.showMessageBox({
    type: 'error',
    title: 'SmartKhata - Unexpected Error',
    message: userMessage,
    buttons: ['Restart', 'Close'],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    app.relaunch();  // Restart
    app.exit(0);
  } else {
    app.exit(1);     // Close
  }
}
```

**Dialog options:**
- **Restart:** Relaunches the app
- **Close:** Exits the app

---

### Handler Registration

**File:** `src/main/index.ts`

```typescript
// Register FIRST, before any other code
registerGlobalErrorHandlers();

// Then continue with app initialization
const gotTheLock = app.requestSingleInstanceLock();
// ...
```

**Why register first?**
- Catches errors during initialization
- Ensures no errors slip through
- Protects entire app lifecycle

---

## Error Scenarios

### Scenario 1: Uncaught Exception

**Code:**
```typescript
// Somewhere in main process
function loadConfig() {
  throw new Error('Config file not found');
}

loadConfig();  // Not wrapped in try/catch
```

**What happens:**
1. Exception thrown
2. `uncaughtException` event fires
3. Error logged with full stack trace
4. User sees dialog: "Error: Config file not found"
5. User chooses Restart or Close

---

### Scenario 2: Unhandled Promise Rejection

**Code:**
```typescript
// Somewhere in main process
async function fetchData() {
  throw new Error('Network request failed');
}

fetchData();  // No .catch()
```

**What happens:**
1. Promise rejected
2. `unhandledRejection` event fires
3. Error logged with full stack trace
4. User sees dialog: "Error: Network request failed"
5. User chooses Restart or Close

---

### Scenario 3: Database Error

**Code:**
```typescript
// Database query fails
db.query('SELECT * FROM products')
  .then(results => {
    // Process results
  });
  // Missing .catch()!
```

**What happens:**
1. Query fails (e.g., table doesn't exist)
2. Promise rejected
3. `unhandledRejection` event fires
4. Error logged
5. User sees dialog with error message
6. User restarts app

---

## Logging Details

### Log Format

```
[2026-02-08T01:59:03.123Z] [ERROR] === UNCAUGHT EXCEPTION === | {
  "message": "Database connection failed",
  "stack": "Error: Database connection failed\n    at buggyFunction (C:\\...\\main\\index.js:123:11)\n    at ...",
  "timestamp": "2026-02-08T01:59:03.123Z",
  "type": "uncaughtException"
}
```

**Includes:**
- Full error message
- Complete stack trace
- Timestamp
- Error type

**Location:**
- Dev: `SmartKhata/dev-data/logs/app-2026-02-08.log`
- Prod: `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\app-2026-02-08.log`

---

## User Experience

### What User Sees

✅ **Friendly message:**
```
An unexpected error occurred and the application may need to restart.
```

✅ **Error summary:**
```
Error: Database connection failed
```

✅ **Timestamp:**
```
Time: 2/8/2026, 1:59:03 AM
```

✅ **Log location:**
```
You can find logs at:
C:\Users\...\SmartKhata\logs\
```

✅ **Action buttons:**
```
[ Restart ]  [ Close ]
```

---

### What User Does NOT See

❌ **Stack traces:**
```
Error: Database connection failed
    at buggyFunction (C:\...\main\index.js:123:11)
    at Object.<anonymous> (C:\...\main\index.js:456:5)
    at Module._compile (node:internal/modules/cjs/loader:1376:14)
    ...
```

❌ **File paths:**
```
at C:\Users\Dev\SmartKhata\src\main\services\database.ts:45:12
```

❌ **Technical jargon:**
```
TypeError: Cannot read property 'query' of undefined
```

---

## Best Practices

### ✅ DO

```typescript
// Wrap risky code in try/catch
try {
  const data = JSON.parse(fileContent);
} catch (error) {
  logger.error('Failed to parse JSON', error);
  // Handle gracefully
}

// Add .catch() to promises
database.query('SELECT * FROM products')
  .then(results => { /* ... */ })
  .catch(error => {
    logger.error('Database query failed', error);
    // Handle gracefully
  });

// Use async/await with try/catch
async function loadData() {
  try {
    const data = await fetchData();
    return data;
  } catch (error) {
    logger.error('Failed to load data', error);
    throw error;  // Re-throw if needed
  }
}
```

---

### ❌ DON'T

```typescript
// Don't ignore errors
try {
  riskyOperation();
} catch (error) {
  // ❌ Silent failure
}

// Don't forget .catch()
database.query('SELECT * FROM products')
  .then(results => { /* ... */ });
  // ❌ Missing .catch()

// Don't expose stack traces to users
dialog.showMessageBox({
  message: error.stack  // ❌ Too technical
});
```

---

## Testing Error Handling

### Manual Testing

**1. Test uncaught exception:**
```typescript
// Add to src/main/index.ts temporarily
app.whenReady().then(() => {
  // Trigger test error
  setTimeout(() => {
    throw new Error('Test uncaught exception');
  }, 5000);
  
  createWindow();
});
```

**Expected:**
- App starts normally
- After 5 seconds, crash dialog appears
- Error logged to file
- User can restart or close

---

**2. Test unhandled rejection:**
```typescript
// Add to src/main/index.ts temporarily
app.whenReady().then(() => {
  // Trigger test error
  setTimeout(() => {
    Promise.reject(new Error('Test unhandled rejection'));
  }, 5000);
  
  createWindow();
});
```

**Expected:**
- App starts normally
- After 5 seconds, crash dialog appears
- Error logged to file
- User can restart or close

---

### Verify Logs

```bash
# Check logs after crash
cat "C:\Users\<User>\AppData\Roaming\SmartKhata\logs\app-*.log"

# Should contain:
# [timestamp] [ERROR] === UNCAUGHT EXCEPTION ===
# or
# [timestamp] [ERROR] === UNHANDLED PROMISE REJECTION ===
```

---

## Production Considerations

### 1. Error Reporting (Future)

```typescript
// Send errors to remote server (optional)
async function reportError(errorDetails: ErrorDetails): Promise<void> {
  try {
    await fetch('https://errors.smartkhata.com/report', {
      method: 'POST',
      body: JSON.stringify(errorDetails),
    });
  } catch (error) {
    // Ignore reporting failures
  }
}
```

---

### 2. Crash Recovery

```typescript
// On startup, check for previous crash
const crashMarkerFile = path.join(app.getPath('userData'), 'crash-marker');

app.whenReady().then(() => {
  if (fs.existsSync(crashMarkerFile)) {
    logger.warn('App crashed last time, running recovery');
    // Show recovery dialog
    // Offer to restore backup
  }
  
  // Create crash marker (deleted on clean shutdown)
  fs.writeFileSync(crashMarkerFile, Date.now().toString());
});
```

---

### 3. Automatic Restart

```typescript
// Auto-restart without user prompt (optional)
function handleUncaughtException(error: Error): void {
  logger.error('=== UNCAUGHT EXCEPTION ===', formatError(error, 'uncaughtException'));
  
  // Auto-restart in production
  if (!config.isDevelopment) {
    app.relaunch();
    app.exit(0);
  } else {
    // Show dialog in development
    showCrashDialog(...);
  }
}
```

---

## Summary

| Aspect | Implementation |
|--------|---------------|
| **Uncaught Exceptions** | Caught and logged |
| **Unhandled Rejections** | Caught and logged |
| **User Dialog** | Friendly, no stack traces |
| **Logging** | Full details with stack traces |
| **User Options** | Restart or Close |
| **Log Location** | Local files only |

**Status:** ✅ Production-ready error handling

**Key principle:** Log everything, show only what's helpful to users

---

**Last updated:** 2026-02-08  
**Files:** `src/main/utils/error-handler.ts`, `src/main/index.ts`
