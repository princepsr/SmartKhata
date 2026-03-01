# SQLite Stack - Technical Decisions

## Final Stack Choice

### Library: `better-sqlite3`

**Decision:** Use `better-sqlite3` v11.x

**Justification:**

- **Performance**: 2-3x faster than `sqlite3` due to synchronous API (no event loop overhead)
- **Simplicity**: Synchronous operations match SQLite's nature (CPU-bound, not I/O-bound)
- **Reliability**: Mature, battle-tested in production Electron apps
- **Memory Safety**: JavaScript-style garbage collection vs manual C memory management
- **Transaction Support**: Built-in full transaction support with automatic rollback
- **Electron Compatible**: Works seamlessly with `electron-rebuild`

**Why NOT `sqlite3` (async):**

- Async overhead adds no value for CPU-bound SQLite operations
- "Mutex thrashing" in event loop reduces performance
- More complex error handling
- No performance benefit for local database

**Why NOT `node:sqlite` (Node.js built-in):**

- Still slower than `better-sqlite3` in benchmarks
- Less mature ecosystem
- Limited Electron testing

---

## Database File Location

### Strategy: OS-Aware Per-User Storage

**Development:**

```
<project-root>/dev-data/smartkhata.db
```

**Production:**

```
C:\Users\<Username>\AppData\Roaming\SmartKhata\data\smartkhata.db
```

**Rationale:**

- ✅ **Per-User**: Each Windows user gets their own database
- ✅ **OS-Safe**: Uses Electron's `app.getPath('userData')` (Windows standard)
- ✅ **Persistent**: Survives app updates/reinstalls
- ✅ **Backed Up**: Included in Windows user profile backups
- ✅ **Permissions**: User has full read/write access (no admin needed)

**Implementation:**
Already implemented in `src/main/config/app-config.ts`:

```typescript
private getDatabasePath(userDataPath: string, isDevelopment: boolean): string {
  if (isDevelopment) {
    return path.join(process.cwd(), 'dev-data', 'smartkhata.db');
  } else {
    return path.join(userDataPath, 'data', 'smartkhata.db');
  }
}
```

---

## File Naming Convention

### Database File: `smartkhata.db`

**Convention:**

- **Main DB**: `smartkhata.db`
- **WAL File**: `smartkhata.db-wal` (auto-created by SQLite)
- **SHM File**: `smartkhata.db-shm` (auto-created by SQLite)

**Backup Files:**

```
<userDataPath>/backups/
  ├── smartkhata-backup-2026-02-08T06-30-00.db
  ├── smartkhata-backup-2026-02-07T06-30-00.db
  └── smartkhata-backup-2026-02-06T06-30-00.db
```

**Backup Naming:**

- Format: `smartkhata-backup-<ISO-DATE>T<TIME>.db`
- Example: `smartkhata-backup-2026-02-08T06-30-00.db`
- Retention: Keep last 7 days (configurable)

---

## Directory Structure

```
Windows Production:
C:\Users\<Username>\AppData\Roaming\SmartKhata\
├── data\
│   ├── smartkhata.db          # Main database
│   ├── smartkhata.db-wal      # Write-Ahead Log
│   └── smartkhata.db-shm      # Shared memory
├── backups\
│   └── smartkhata-backup-*.db # Daily backups
└── logs\
    └── app-*.log              # Application logs

Development:
<project-root>\
├── dev-data\
│   ├── smartkhata.db
│   ├── smartkhata.db-wal
│   └── smartkhata.db-shm
└── src\
```

---

## Installation

```bash
# Install better-sqlite3
pnpm add better-sqlite3

# Install types
pnpm add -D @types/better-sqlite3

# Rebuild for Electron (after install)
pnpm electron-rebuild
```

---

## Configuration Summary

| Aspect            | Decision                           | Reason                               |
| ----------------- | ---------------------------------- | ------------------------------------ |
| **Library**       | `better-sqlite3` v11.x             | Performance, simplicity, reliability |
| **API Style**     | Synchronous                        | Matches SQLite's CPU-bound nature    |
| **Dev Location**  | `./dev-data/smartkhata.db`         | Easy access, git-ignored             |
| **Prod Location** | `AppData/Roaming/SmartKhata/data/` | OS-standard, per-user, persistent    |
| **Testing Stack** | `sql.js` (WASM)                    | Environment-agnostic, no ABI issues  |
| **File Name**     | `smartkhata.db`                    | Simple, lowercase, no version        |
| **Backup Format** | `smartkhata-backup-<ISO-DATE>.db`  | Sortable, human-readable             |

---

## Next Steps

1. Install `better-sqlite3` package
2. Create database initialization module
3. Implement migration system
4. Build repository base class
5. Add corruption recovery logic

---

**Last Updated:** 2026-02-19
**Status:** ✅ Phase 1 Complete (Rupee-based Storage Unified)
