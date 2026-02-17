# Logging Setup

## Overview

SmartKhata uses a simple file-based logging system for the Electron main process. Logs are stored locally and automatically rotated to prevent disk space issues.

---

## Features

✅ **Daily log files** - One file per day (`app-2026-02-08.log`)  
✅ **Auto-rotation** - Keeps last 7 days, deletes older logs  
✅ **Development mode** - Console output only (no file writes except errors)  
✅ **Production mode** - File output for all logs  
✅ **Error tracking** - Always writes errors to file (even in dev)  
✅ **Structured logging** - JSON data support  
✅ **PII Sanitization** - Automatic redaction of sensitive fields (phones, items, etc.)  
✅ **Module Scoping** - Tagged logs (e.g., `[DB]`, `[IPC]`, `[LICENSE]`, `[AUDIT]`)  
✅ **Rotate-on-Start** - Ensures current log is always clean and archival is handled.

---

## Log File Locations

### Development

```
SmartKhata/dev-data/logs/
└── app-2026-02-08.log
```

### Production

```
C:\Users\<Username>\AppData\Roaming\SmartKhata\logs\
├── app-2026-02-08.log
├── app-2026-02-07.log
└── ... (up to 7 days)
```

---

## Usage

### Basic Logging

```typescript
// Module-specific logger (Recommended)
const dbLogger = logger.forModule('DB');
dbLogger.info('Query executed', { sql: 'SELECT...', duration: 5 });

// Standard Logging
logger.info('Application started');
logger.error('Failed to save sale', new Error('Database locked'));
```

### With Structured Data

```typescript
// Log with additional context
logger.info('Sale completed', {
  saleId: 789,
  total: 1500,
  items: 5,
  customer: 'Rajesh Kumar',
});

// Log errors with stack traces
try {
  await saveSale(data);
} catch (error) {
  logger.error('Failed to save sale', error);
}
```

---

## Log Levels

| Level      | When to Use              | Dev Output     | Prod Output   |
| ---------- | ------------------------ | -------------- | ------------- |
| `DEBUG`    | Detailed debugging info  | Console        | ❌ Not logged |
| `INFO`     | General information      | Console        | File          |
| `AUDIT`    | User actions (Sale, Del) | Console        | File          |
| `DATABASE` | SQL/Migration events     | Console        | File          |
| `UPDATE`   | Auto-update cycles       | Console        | File          |
| `WARN`     | Potential issues         | Console        | File          |
| `ERROR`    | Errors and exceptions    | Console + File | File          |

---

## Log Format

```
[2026-02-17T10:00:00.000Z] [INFO][MAIN] Application started
[2026-02-17T10:00:02.000Z] [DEBUG][DB] Query executed | {"sql":"SELECT...","duration":5}
[2026-02-17T10:00:05.000Z] [INFO][IPC] Sale completed | {"customerPhone":"[REDACTED]","total":1500}
[2026-02-17T10:00:10.000Z] [ERROR][MAIN] Unhandled crash | {"message":"Something broke","stack":"..."}
```

**Format:**

```
[ISO Timestamp] [LEVEL] Message | {"optional":"data"}
```

---

## Integration in Main Process

### Startup Logging

```typescript
// src/main/index.ts
import { logger } from './utils/logger';

app.whenReady().then(() => {
  logger.info('=== SmartKhata Starting ===');
  logger.info('Environment', { isDevelopment: config.isDevelopment });
  logger.info('Version', { version: config.appVersion });
  logger.info('Database Path', { path: config.databasePath });

  createWindow();
});
```

### Error Handling

```typescript
// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});
```

### Service Layer

```typescript
// src/main/services/product-service.ts
import { logger } from '@main/utils/logger';

export class ProductService {
  async createProduct(data: Product): Promise<Product> {
    logger.info('Creating product', { name: data.name });

    try {
      const product = await this.repository.create(data);
      logger.info('Product created', { id: product.id });
      return product;
    } catch (error) {
      logger.error('Failed to create product', error);
      throw error;
    }
  }
}
```

---

## Log Rotation

### How It Works

1. **Daily files**: New log file created each day
2. **Auto-cleanup**: On app startup, deletes logs older than 7 days
3. **No manual intervention**: Fully automatic

### Example Timeline

```
Day 1: app-2026-02-01.log created
Day 2: app-2026-02-02.log created
...
Day 7: app-2026-02-07.log created
Day 8: app-2026-02-08.log created
       app-2026-02-01.log deleted (older than 7 days)
```

---

## Accessing Logs

### Get Log File Path

```typescript
import { logger } from '@main/utils/logger';

// Get current log file
const logFile = logger.getLogFilePath();
console.log('Current log:', logFile);

// Get logs directory
const logsDir = logger.getLogsDirectory();
console.log('Logs directory:', logsDir);
```

### Open Logs Folder (for debugging)

```typescript
import { shell } from 'electron';
import { logger } from '@main/utils/logger';

// Open logs folder in file explorer
shell.openPath(logger.getLogsDirectory());
```

### Add to App Menu (optional)

```typescript
// In main menu
{
  label: 'Help',
  submenu: [
    {
      label: 'Open Logs Folder',
      click: () => {
        shell.openPath(logger.getLogsDirectory());
      }
    }
  ]
}
```

---

## Troubleshooting

### Logs not being written

**Check:**

1. Logs directory exists: `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\`
2. App has write permissions
3. Disk space available

**Fix:**

```typescript
// Logger auto-creates directory, but you can manually verify:
import fs from 'fs';
import { logger } from '@main/utils/logger';

const logsDir = logger.getLogsDirectory();
console.log('Logs dir exists:', fs.existsSync(logsDir));
```

---

### Too many log files

**Symptom:** More than 7 log files in directory

**Fix:** Auto-cleanup runs on startup. Restart the app.

**Manual cleanup:**

```typescript
// Delete all logs older than 7 days
import fs from 'fs';
import path from 'path';

const logsDir = logger.getLogsDirectory();
const files = fs.readdirSync(logsDir);
const maxAge = 7 * 24 * 60 * 60 * 1000;

files.forEach((file) => {
  const filePath = path.join(logsDir, file);
  const stats = fs.statSync(filePath);
  if (Date.now() - stats.mtimeMs > maxAge) {
    fs.unlinkSync(filePath);
  }
});
```

---

## Best Practices

### DO ✅

```typescript
// Log important events
logger.info('Sale completed', { saleId: 123, total: 1500 });

// Log errors with context
logger.error('Database query failed', { query: 'SELECT * FROM products', error });

// Use structured data
logger.warn('Low stock', { productId: 456, currentStock: 5, threshold: 10 });
```

### DON'T ❌

```typescript
// Don't log sensitive data
logger.info('User password', { password: '12345' }); // ❌

// Don't log in tight loops
for (let i = 0; i < 10000; i++) {
  logger.debug('Processing item', { i }); // ❌ Too many logs
}

// Don't log huge objects
logger.info('All products', { products: allProducts }); // ❌ Too large
```

---

## Future Enhancements (Optional)

### Log Levels Configuration

```typescript
// Allow users to set log level
logger.setLevel(LogLevel.WARN); // Only WARN and ERROR
```

### Remote Logging (if cloud sync added)

```typescript
// Send errors to remote server
logger.onError((message, error) => {
  sendToRemoteServer({ message, error });
});
```

### Log Viewer UI

```typescript
// Add a log viewer in the app
// src/renderer/pages/LogsPage.tsx
```

---

## Summary

| Aspect        | Solution                                           |
| ------------- | -------------------------------------------------- |
| **Storage**   | Daily files in `AppData/Roaming/SmartKhata/logs/`  |
| **Rotation**  | Auto-delete logs older than 7 days                 |
| **Dev mode**  | Console output (errors also to file)               |
| **Prod mode** | All logs to file                                   |
| **Format**    | `[timestamp] [level] message \| {data}`            |
| **Usage**     | `logger.info()`, `logger.warn()`, `logger.error()` |

**Philosophy:**

- ✅ Simple file-based logging
- ✅ No external dependencies
- ✅ Automatic rotation
- ✅ Useful for debugging in kirana shops
- ✅ No overengineering

---

**Last updated:** 2026-02-18 (Phase 1 Complete)  
**Status:** ✅ Professional grade auditing enabled
