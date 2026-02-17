# Graceful Shutdown Handling

## Overview

SmartKhata implements graceful shutdown to ensure data integrity and prevent corruption when the app closes. The shutdown manager provides hooks for cleanup operations like closing database connections and triggering backups.

---

## Architecture

```
User closes app (X / Alt+F4)
    ↓
app.on('before-quit')
    ↓
shutdownManager.shutdown()
    ↓
Priority-Based Execution (ASC: 100 → 300)
    ↓
1. NORMAL (100): General transient services
2. HIGH (200): Resource trackers, Stability watchdog
3. CRITICAL (300): Database Close, WAL Checkpoint, Exit Marker
    ↓
app.quit() (Final exit)
```

---

## Shutdown Manager

**File:** `src/main/utils/shutdown-manager.ts`

### Implementation

```typescript
class ShutdownManager {
  private hooks: ShutdownHook[] = [];
  private isShuttingDown = false;

  // Register a shutdown hook
  public registerHook(hook: ShutdownHook): void {
    this.hooks.push(hook);
  }

  // Execute all hooks in reverse order (LIFO)
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    const reversedHooks = [...this.hooks].reverse();

    for (const hook of reversedHooks) {
      try {
        await hook();
      } catch (error) {
        logger.error('Shutdown hook failed', error);
        // Continue with other hooks
      }
    }
  }
}
```

---

## Registered Hooks

**File:** `src/main/utils/shutdown-manager.ts`

```typescript
export function registerShutdownHooks(): void {
  // Hook 1: Close database (future)
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Close database (placeholder)');
    // TODO: await database.close();
  });

  // Hook 2: Trigger backup (future)
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Trigger backup (placeholder)');
    // TODO: await backupService.createBackup();
  });

  // Hook 3: Flush logs (future)
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Flush logs (placeholder)');
    // TODO: await logger.flush();
  });
}
```

**Execution order:** Priority Groups (100 → 200 → 300)

- Registered with Group 100 (NORMAL)
- Registered with Group 200 (HIGH) - e.g. `StabilityService`
- Registered with Group 300 (CRITICAL) - e.g. `DatabaseManager` + `Exit Marker`

**Why priority?**

- Stability Service must clean up windows _before_ the Database closes.
- Database must commit and checkpoint WAL _before_ the Exit Marker is written.
- Exit Marker must be the _absolute last_ byte written to signify a healthy shutdown.

---

## Main Process Integration

**File:** `src/main/index.ts`

### Startup

```typescript
app.whenReady().then(() => {
  // Register shutdown hooks on startup
  registerShutdownHooks();

  createWindow();
});
```

### Shutdown

```typescript
app.on('before-quit', async (event) => {
  if (!shutdownManager.isShutdownInProgress()) {
    // Prevent immediate quit
    event.preventDefault();

    logger.info('App quit requested, starting graceful shutdown');
    await shutdownManager.shutdown();

    // Now allow quit
    app.quit();
  }
});
```

---

## Shutdown Flow

### Normal Shutdown

```
1. User clicks X or Alt+F4
   ↓
2. 'before-quit' event fires
   ↓
3. event.preventDefault() (block quit)
   ↓
4. shutdownManager.shutdown()
   ↓
5. Execute hooks:
   - Flush logs
   - Trigger backup
   - Close database
   ↓
6. app.quit() (proceed with quit)
   ↓
7. App closes
```

### Force Quit (Ctrl+C, Task Manager)

```
1. Force quit signal
   ↓
2. No 'before-quit' event
   ↓
3. App terminates immediately
   ↓
4. No cleanup (unavoidable)
```

**Note:** Force quit cannot be prevented, but SQLite handles this gracefully (rollback uncommitted transactions).

---

## Preventing Data Corruption

### Database Safety

**Problem:**

- User closes app mid-transaction
- Database left in inconsistent state

**Solution:**

```typescript
shutdownManager.registerHook(async () => {
  // Close database gracefully
  await database.close();
  // SQLite commits pending transactions
  // Closes file handles properly
});
```

**Future implementation:**

```typescript
// src/main/database/connection.ts
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    logger.info('Database closed gracefully');
  }
}
```

---

### Backup Trigger

**Problem:**

- User closes app without recent backup
- Data loss if file corrupts

**Solution:**

```typescript
shutdownManager.registerHook(async () => {
  // Trigger backup on shutdown
  await backupService.createBackup();
});
```

**Future implementation:**

```typescript
// src/main/services/backup-service.ts
export async function createBackup(): Promise<void> {
  const timestamp = new Date().toISOString();
  const backupPath = `backups/backup-${timestamp}.zip`;

  await zipDatabase(config.databasePath, backupPath);
  logger.info('Backup created', { path: backupPath });
}
```

---

### Log Flushing

**Problem:**

- Logs buffered in memory
- Lost on sudden shutdown

**Solution:**

```typescript
shutdownManager.registerHook(async () => {
  // Flush logs to disk
  await logger.flush();
});
```

**Future implementation:**

```typescript
// src/main/utils/logger.ts
public async flush(): Promise<void> {
  // Force write buffered logs to disk
  await fs.promises.fsync(this.fileHandle);
}
```

---

## Hook Registration Pattern

### Adding New Hooks

```typescript
// In your service initialization
export function initializeMyService(): void {
  // ... service setup

  // Register cleanup hook
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: My service cleanup');
    await myService.cleanup();
  });
}
```

### Example: Printer Service

```typescript
// src/main/services/printer-service.ts
export function initializePrinterService(): void {
  // ... setup

  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Cancel pending print jobs');
    await printerService.cancelAllJobs();
  });
}
```

---

## Error Handling

### Hook Failure

```typescript
for (const hook of reversedHooks) {
  try {
    await hook();
  } catch (error) {
    logger.error('Shutdown hook failed', error);
    // Continue with other hooks (don't block shutdown)
  }
}
```

**Why continue on error?**

- One failed hook shouldn't block entire shutdown
- Log the error for debugging
- Other hooks may still succeed

---

### Timeout Protection (Future)

```typescript
async function executeHookWithTimeout(hook: ShutdownHook, timeoutMs: number = 5000): Promise<void> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Hook timeout')), timeoutMs)
  );

  await Promise.race([hook(), timeoutPromise]);
}
```

**Use case:** Prevent hung hooks from blocking shutdown indefinitely

---

## Best Practices

### ✅ DO

```typescript
// Register hooks on startup
app.whenReady().then(() => {
  registerShutdownHooks();
});

// Make hooks idempotent (safe to call multiple times)
shutdownManager.registerHook(async () => {
  if (db && db.isOpen()) {
    await db.close();
  }
});

// Log hook execution
shutdownManager.registerHook(async () => {
  logger.info('Shutdown hook: Close database');
  await database.close();
});
```

### ❌ DON'T

```typescript
// Don't register hooks multiple times
createWindow(); // ❌ Registers hooks
createWindow(); // ❌ Registers again (duplicates!)

// Don't throw errors from hooks
shutdownManager.registerHook(async () => {
  throw new Error('Failed!'); // ❌ Blocks other hooks
});

// Don't perform long operations
shutdownManager.registerHook(async () => {
  await longRunningTask(); // ❌ User waits too long
});
```

---

## Testing Shutdown

### Manual Testing

```bash
# 1. Start app
pnpm dev

# 2. Close app (Alt+F4 or X button)

# 3. Check logs
cat dev-data/logs/app-*.log

# Expected output:
# [timestamp] [INFO] App quit requested, starting graceful shutdown
# [timestamp] [INFO] === Starting graceful shutdown ===
# [timestamp] [INFO] Shutdown hook: Flush logs (placeholder)
# [timestamp] [INFO] Shutdown hook: Trigger backup (placeholder)
# [timestamp] [INFO] Shutdown hook: Close database (placeholder)
# [timestamp] [INFO] === Graceful shutdown complete ===
```

---

### Automated Testing (Future)

```typescript
// tests/shutdown.test.ts
describe('Shutdown Manager', () => {
  it('should execute hooks in LIFO order', async () => {
    const order: number[] = [];

    shutdownManager.registerHook(async () => {
      order.push(1);
    });
    shutdownManager.registerHook(async () => {
      order.push(2);
    });
    shutdownManager.registerHook(async () => {
      order.push(3);
    });

    await shutdownManager.shutdown();

    expect(order).toEqual([3, 2, 1]); // LIFO
  });
});
```

---

## Future Enhancements

### 1. Shutdown Timeout

```typescript
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

setTimeout(() => {
  logger.warn('Shutdown timeout, forcing quit');
  process.exit(1);
}, SHUTDOWN_TIMEOUT);

await shutdownManager.shutdown();
```

---

### 2. Shutdown Progress UI

```typescript
// Show shutdown progress to user
mainWindow.webContents.send('shutdown-progress', {
  message: 'Closing database...',
  progress: 33,
});
```

---

### 3. Crash Recovery

```typescript
// On startup, check for crash
if (didCrashLastTime()) {
  logger.warn('App crashed last time, running recovery');
  await database.recover();
}
```

---

## Summary

| Aspect               | Implementation                  |
| -------------------- | ------------------------------- |
| **Shutdown Manager** | Centralized hook system         |
| **Hook Order**       | LIFO (Last In, First Out)       |
| **Error Handling**   | Continue on failure, log errors |
| **Database**         | Placeholder for graceful close  |
| **Backup**           | Placeholder for shutdown backup |
| **Logs**             | Placeholder for flush           |

**Status:** ✅ Infrastructure ready, hooks are placeholders

**Next steps:**

1. Implement database connection management
2. Implement backup service
3. Add shutdown timeout protection

---

**Last updated:** 2026-02-08  
**Files:** `src/main/utils/shutdown-manager.ts`, `src/main/index.ts`
