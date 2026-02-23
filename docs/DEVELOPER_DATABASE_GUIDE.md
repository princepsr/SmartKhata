# Developer Database Guide

This guide provides instructions and useful commands for developers working with the SmartKhata database.

---

## 🏗️ Quick Setup & Testing

### 1. Generate Seed Data (Dump)

Use this command to generate a SQL dump of your current database. This is useful for creating a shareable "seed" file for testing.

```bash
# Locate your database file (typically dev-data/smartkhata.db in development)
# Save it to the standard seed directory
sqlite3 dev-data/smartkhata.db .dump > src/main/database/seed/polaris.sql
```

### 2. Restore from Seed

To reset your database state to a known seed:

```bash
# 1. Delete the current database
rm dev-data/smartkhata.db

# 2. Restore from the seed file
sqlite3 dev-data/smartkhata.db < src/main/database/seed/polaris.sql
```

> [!NOTE]
> **Prerequisite**: The `sqlite3` CLI tool must be installed and added to your system PATH. If you are on Windows, you can download the tools from the [SQLite website](https://www.sqlite.org/download.html).

> [!TIP]
> After restoring, the application's migration runner will automatically run any pending migrations if the seed file is from an older schema version.

---

## 🛠️ Useful Commands

### Inspection

- **List Tables**: `sqlite3 dev-data/smartkhata.db .tables`
- **Show Schema**: `sqlite3 dev-data/smartkhata.db .schema [table_name]`
- **List Indices**: `sqlite3 dev-data/smartkhata.db "SELECT name FROM sqlite_master WHERE type='index';"`

## 🔄 Related Documentation

- [Database Migrations](DATABASE_MIGRATIONS.md): How schema changes are managed.
- [Backup & Restore](BACKUP_RESTORE.md): Application-level data safety features.
- [Database Stack](DATABASE_STACK.md): Core technologies used (better-sqlite3).
