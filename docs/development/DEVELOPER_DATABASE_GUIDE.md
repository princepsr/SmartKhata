# Developer Database Guide

This guide provides "Full Detailed" technical instructions for developers interacting with the SmartKhata SQLite persistence layer.

---

## 🏗️ Quick Setup & Testing

### 1. Generating SQL Dumps (Seeding)

To create a shareable state for testing or bug reporting:

```bash
# Dump the dev database to a SQL seed file
sqlite3 dev-data/smartkhata.db .dump > src/main/database/seed/dev_snapshot.sql
```

### 2. Restoring to Baseline

```bash
# 1. Kill the app and delete current DB
rm dev-data/smartkhata.db

# 2. Restore from seed
sqlite3 dev-data/smartkhata.db < src/main/database/seed/polaris.sql
```

---

## 🔄 Migration Workflow

The database schema is managed via a strict migration-based versioning system in `src/main/database/migrations/`.

### Creating a New Migration

1.  **File Naming**: Use the pattern `XXX_description.sql` (e.g., `030_add_loyalty_points.sql`).
2.  **Schema Only**: Only include DDL statements (`CREATE`, `ALTER`, `DROP`). Use `000_seed_data.sql` for initial content if needed.
3.  **Atomic Changes**: Keep migrations small. The system runs them within a single transaction; if one statement fails, the entire migration rolls back.
4.  **Verification**: After adding a file, restart the app. Check `src/main/database/migration-runner.ts` logs for confirmation.

---

## 🔍 Advanced Debugging

### 1. Verbose SQL Logging

To see raw queries executed by `better-sqlite3`:

1.  Open `src/main/database/connection-manager.ts`.
2.  Modify the database constructor:
    ```typescript
    const db = new Database(dbPath, {
      verbose: console.log, // Logs every query to terminal
    });
    ```

### 2. PRAGMA Integrity Checks

If you suspect data corruption (common after hard crashes or disk full errors):

```bash
sqlite3 dev-data/smartkhata.db "PRAGMA integrity_check;"
```

If it returns anything other than `ok`, you may need to run `PRAGMA incremental_vacuum;` or restore from a backup.

---

## 🛠️ CLI Power Tools

- **Table Stats**: `sqlite3 dev-data/smartkhata.db "SELECT * FROM dbstat;"` (Analyze physical storage).
- **Query Plan**: `sqlite3 dev-data/smartkhata.db "EXPLAIN QUERY PLAN SELECT ..."` (Verify index usage).
- **WAL Check**: `ls -l dev-data/smartkhata.db-wal` (Ensure Write-Ahead Logging is active).

---

**Last Updated**: 2026-02-28
**Related Docs**: [DATABASE_SCHEMA.md](../database/DATABASE_SCHEMA.md), [BACKUP_RESTORE.md](../database/BACKUP_RESTORE.md)
