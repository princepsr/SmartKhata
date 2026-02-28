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
  private hooks: RegisteredHook[] = [];
  private isShuttingDown = false;

  // Register a shutdown hook with priority (100 = Normal, 200 = High, 300 = Critical)
  public registerHook(
    hook: ShutdownHook,
    priority: ShutdownPriority = 100,
    description?: string
  ): void {
    this.hooks.push({ hook, priority, description });
  }

  // Execute all hooks in priority order (100 -> 200 -> 300)
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    const sortedHooks = [...this.hooks].sort((a, b) => a.priority - b.priority);

    for (const h of sortedHooks) {
      try {
        await h.hook();
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
  // Hook 1: Close database (CRITICAL priority)
  shutdownManager.registerHook(
    async () => {
      if (databaseManager.isReady()) {
        databaseManager.close();
      }
    },
    ShutdownPriority.CRITICAL,
    'Database Shutdown'
  );

  // Hook 2: Stop background tasks (HIGH priority)
  shutdownManager.registerHook(
    async () => {
      const { autoBackupService } = await import('../services/auto-backup-service.js');
      autoBackupService.stop();
    },
    ShutdownPriority.HIGH,
    'Auto Backup Service Shutdown'
  );

  // Hook 3: Write clean exit marker (CRITICAL priority, runs after database due to FIFO)
  shutdownManager.registerHook(
    () => {
      fs.writeFileSync(
        markerPath,
        JSON.stringify({ timestamp: new Date(), version: app.getVersion() })
      );
    },
    ShutdownPriority.CRITICAL,
    'Exit Marker'
  );
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

### 1. Timeout Protection ✅ **IMPLEMENTED**

To prevent hung hooks from blocking the application shutdown indefinitely, a global failsafe is implemented in the Main process:

```typescript
// src/main/index.ts
app.on('before-quit', async (event) => {
  if (forceQuit) return; // Allow second quit attempt to proceed

  // Global failsafe: Force exit if hooks take > 5 seconds
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out (5s), forcing exit');
    process.exit(0); 
  }, 5000);

  await shutdownManager.shutdown();
  forceQuit = true;
  app.quit();
});
```

**Security Impact:**
- Ensures the app always closes, even if a database connection is locked or a backup hangs.
- Prevents "Zombie Processes" from consuming system resources after the window is closed.

---

### 2. Shutdown Progress UI (Future)

To improve user experience during long operations (like a final cloud backup), the system could send progress updates to the renderer before the window is destroyed.

---

**Last updated:** 2026-02-24  
**Files:** `src/main/utils/shutdown-manager.ts`, `src/main/index.ts`
