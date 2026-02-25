# SmartKhata

**Local-first Kirana application for Windows**

A fast, offline-first point-of-sale system built for Indian kirana shops.

**[Phase 1 Completion Summary](docs/PHASE1_COMPLETION_SUMMARY.md)** | **[Changelog](CHANGELOG.md)** | **[Installation Guide](docs/INSTALLATION.md)**

---

## Tech Stack

| Layer                 | Technology                |
| --------------------- | ------------------------- |
| **Desktop Framework** | Electron 34               |
| **UI**                | React 18 + TypeScript     |
| **Build Tool**        | Vite 6                    |
| **Database**          | SQLite (better-sqlite3)   |
| **Testing**           | Vitest + In-memory SQLite |
| **Package Manager**   | pnpm                      |
| **Linting**           | ESLint + Prettier         |

**Architecture:** Clean layered architecture (UI → IPC → Service → Repository → Database)

---

## Folder Structure

```
SmartKhata/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Database access
│   │   ├── ipc-handlers/  # IPC event handlers
│   │   ├── database/      # SQLite setup & migrations
│   │   ├── utils/         # Logger, printer, etc.
│   │   └── config/        # App configuration
│   │
│   ├── renderer/          # React UI
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom hooks (useIPC, useLocalStorage)
│   │   ├── services/      # Shared IPC abstractions
│   │   └── styles/        # Global styles
│   │
│   ├── preload/           # IPC bridge (security)
│   │   └── index.ts
│   │
│   └── shared/            # Shared code (main + renderer)
│       ├── types/         # TypeScript types
│       ├── constants/     # App constants, IPC events
│       └── utils/         # Shared utilities
│
├── docs/                  # Documentation
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── FOLDER_STRUCTURE.md
│   ├── TYPESCRIPT_SETUP.md
│   ├── LINTING_FORMATTING.md
│   ├── DEV_SCRIPTS.md
│   ├── ENVIRONMENT_CONFIG.md
│   └── LOGGING.md
│
├── resources/             # Icons, assets
├── database/              # Schema docs, sample data
└── tests/                 # Tests
```

**See [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) for detailed breakdown.**

---

## Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **pnpm** 9+ (Install: `npm install -g pnpm`)
- **Windows** 10/11 (primary target)

### Setup (5 minutes)

```bash
# 1. Clone the repo
git clone https://github.com/princepsr/SmartKhata.git
cd SmartKhata

# 2. Install dependencies
pnpm install

# 3. Run development mode
pnpm dev
```

**That's it!** Vite dev server starts on `http://localhost:5173`, Electron launches automatically.

---

## Development

### Available Scripts

```bash
# Development (one command starts everything)
pnpm dev              # Vite + TypeScript watch + Electron

# Individual dev processes
pnpm dev:renderer     # Vite dev server only
pnpm dev:main         # TypeScript watch + Auto-restart Electron

# Code Quality
pnpm lint             # Check linting errors
pnpm lint:fix         # Auto-fix linting errors
pnpm format           # Format code with Prettier
pnpm type-check       # TypeScript type checking
pnpm release:check    # Quality gates (Lint + Types + Tests)

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:ui          # Run tests with UI
pnpm test:coverage    # Generate coverage report

# Build
pnpm build            # Production build (main + renderer)
pnpm build:win        # Windows installer (NSIS + portable)
pnpm build:win:portable  # Portable .exe only

# Utilities
pnpm release 1.0.1    # Automated Release (Lint + Test + Tag + Push)
pnpm clean            # Remove build directories
```

**See [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md) for detailed workflow.**

---

## Architecture Principles

### Golden Rules

1. **UI never touches DB** - All data access via services
2. **IPC for everything** - Renderer ↔ Main communication only via IPC
3. **Repository pattern** - Abstraction for future cloud sync
4. **Local-first** - Works offline, cloud is optional
5. **Soft Delete** - Deactivate products/customers (never permanent delete)
6. **No overengineering** - Simple, boring solutions

### Data Flow

```
React Component
  ↓ (uses hook)
Custom Hook
  ↓ (calls IPC)
IPC Client (renderer)
  ↓ (IPC call via preload)
IPC Handler (main)
  ↓ (calls service)
Service Layer
  ↓ (business logic, validation)
Repository Layer
  ↓ (SQL query)
SQLite Database
```

**See [CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md) for complete architecture.**

---

### 🛡️ SmartKhata Core Features

- **🚀 Command Center**: Unified hub for zero-friction navigation and high-frequency actions (Add Product/Customer, Reports, Settings).
- **⚡ Super-Speed Billing**: High-performance transaction engine with virtual barcode support and instant thermal printing.
- **🛡️ Secure Licensing**: Hardware-bound machine activation with offline support and transparent IST-aligned trial management.
- **🎁 Referral Program**: Built-in 10% cashback referral system driven by deterministically generated, easy-to-spell Customer IDs (Crockford Base32) designed for offline data safety.
- **📊 Advanced Analytics**: Daily/Weekly/Monthly trend insights with GST-ready reporting and accurate local time attribution.
- **☁️ Cloud Sync & Backups**: Automated, configurable background database backups with seamless Google Drive synchronization to prevent data loss.

**See [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) for complete schema documentation.**

---

## Configuration

### Environment Detection

- **Development:** `NODE_ENV=development` (auto-set by Vite)
- **Production:** `NODE_ENV=production` (auto-set during build)

### App Constants

All constants in `src/shared/constants/app-constants.ts`:

- App metadata (name, version)
- IPC event names
- Business rules (currency, tax)
- Validation rules

**See [ENVIRONMENT_CONFIG.md](docs/ENVIRONMENT_CONFIG.md) for details.**

---

## Logging

**File-based logging** for main process:

```typescript
import { logger } from '@main/utils/logger';

logger.info('Sale completed', { saleId: 123, total: 1500 });
logger.warn('Low stock', { productId: 456, stock: 5 });
logger.error('Database error', error);
```

**Log files:**

- Dev: `SmartKhata/dev-data/logs/app-2026-02-08.log`
- Prod: `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\app-2026-02-08.log`

**Auto-rotation:** Keeps last 7 days, deletes older logs.

**See [LOGGING.md](docs/LOGGING.md) for usage.**

---

## Building for Production

### Windows Installer

```bash
# Build both NSIS installer and portable exe
pnpm build:win
```

**Output:**

```
release/
├── SmartKhata Setup 1.0.0.exe    # Installer
└── SmartKhata 1.0.0.exe          # Portable
```

### Portable Only (faster for testing)

```bash
pnpm build:win:portable
```

**See [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md) for build configuration.**

---

## Documentation Index

### 🏗️ Architecture & Core Logic

| Document                                                        | Purpose                               |
| :-------------------------------------------------------------- | :------------------------------------ |
| [CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md)         | **High-level architecture overview**  |
| [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md)     | Technical choices and design patterns |
| [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)                 | Detailed file/folder responsibilities |
| [BILLING_SERVICE_FLOW.md](docs/BILLING_SERVICE_FLOW.md)         | State machine for atomic billing      |
| [BILLING_TRANSACTION_FLOW.md](docs/BILLING_TRANSACTION_FLOW.md) | Step-by-step transaction logic        |
| [TAXATION_AND_DISCOUNTS.md](docs/TAXATION_AND_DISCOUNTS.md)     | GST Models and Proportional Discounts |
| [CUSTOMER_MANAGEMENT.md](docs/CUSTOMER_MANAGEMENT.md)           | Profiles and Ledger Integration       |
| [PRINT_SERVICE.md](docs/PRINT_SERVICE.md)                       | Thermal printing & window pooling     |
| [REPORTS_ARCHITECTURE.md](docs/REPORTS_ARCHITECTURE.md)         | Analytics & multi-format exports      |
| [SOFTWARE_UPDATE.md](docs/SOFTWARE_UPDATE.md)                   | **Auto-update & Release lifecycle**   |

### �️ System Reliability

| Document                                                              | Purpose                               |
| :-------------------------------------------------------------------- | :------------------------------------ |
| [SERVICE_ERROR_FLOW.md](docs/SERVICE_ERROR_FLOW.md)                   | Standardized error mapping (Ipc/Main) |
| [GRACEFUL_SHUTDOWN.md](docs/GRACEFUL_SHUTDOWN.md)                     | WAL checkpointing & shutdown hooks    |
| [ERROR_HANDLING.md](docs/ERROR_HANDLING.md)                           | Global crash recovery & logging       |
| [DATABASE_PERFORMANCE_SAFETY.md](docs/DATABASE_PERFORMANCE_SAFETY.md) | WAL mode & query optimization         |

### �📂 Data & Persistence

| Document                                                  | Purpose                            |
| :-------------------------------------------------------- | :--------------------------------- |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)             | Product, Bill, and Customer tables |
| [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md)     | Schema versioning & runner logic   |
| [REPOSITORY_RULES.md](docs/REPOSITORY_RULES.md)           | SQL query & domain mapping rules   |
| [DATABASE_TRANSACTIONS.md](docs/DATABASE_TRANSACTIONS.md) | ACID compliance & error recovery   |
| [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)               | Atomic ZIP-based data archival     |

### 🔐 Security & Operations

| Document                                                      | Purpose                                 |
| :------------------------------------------------------------ | :-------------------------------------- |
| [SECURITY_AND_VALIDATION.md](docs/SECURITY_AND_VALIDATION.md) | Zod, IPC Guards, & Sanitization         |
| [IPC_ARCHITECTURE.md](docs/IPC_ARCHITECTURE.md)               | Request-Response bridge design          |
| [IPC_DESIGN_RULES.md](docs/IPC_DESIGN_RULES.md)               | Channel naming & response patterns      |
| [LICENSING_STRATEGY.md](docs/LICENSING_STRATEGY.md)           | Trials, hardware binding, & anti-tamper |
| [ADMIN_KEY_GENERATION.md](docs/ADMIN_KEY_GENERATION.md)       | Internal license key generation guide   |
| [APP_METADATA.md](docs/APP_METADATA.md)                       | Versioning, icons, & branding config    |
| [LOGGING.md](docs/LOGGING.md)                                 | Structured auditing & sanitized logs    |
| [ENVIRONMENT_CONFIG.md](docs/ENVIRONMENT_CONFIG.md)           | Dev/Prod path management                |

### 🛠️ Developer Guides

| Document                                                        | Purpose                               |
| :-------------------------------------------------------------- | :------------------------------------ |
| [INSTALLATION.md](docs/INSTALLATION.md)                         | **Setup & production build guide**    |
| [UI_PATTERNS.md](docs/UI_PATTERNS.md)                           | Performance, Scroll, & Debouncing     |
| [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md)                           | Full CLI script documentation         |
| [TESTING_GUIDE.md](docs/TESTING_GUIDE.md)                       | Unit, integration & hardware testing  |
| [TYPESCRIPT_SETUP.md](docs/TYPESCRIPT_SETUP.md)                 | Path aliases & TS configuration       |
| [DEVELOPER_DATABASE_GUIDE.md](docs/DEVELOPER_DATABASE_GUIDE.md) | **DB dumping & restoration commands** |
| [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)                         | Branching & merge protocols           |

---

## Roadmap

### Phase 1 (Completed) - Local-First MVP

- Windows desktop app
- SQLite database
- Offline billing
- Thermal printing
- Inventory management
- Automated Backups & Google Drive Sync

---

## Security & Licensing

SmartKhata includes a robust, offline-first licensing system:

- **Triple Redundancy**: License markers are stored in 3 obscure system locations + the Windows Registry to prevent trial reset by deleting folders.
- **Anti-Time-Travel**: Implements a "High-Water Mark" monotonic clock. If a user sets their system clock backward, the app detects it and usage time remains "frozen."
- **Cryptographic Binding**: All licenses are cryptographically signed and bound to the machine's unique hardware fingerprint.
- **Code Obfuscation**: Production builds are obfuscated using `javascript-obfuscator` to prevent reverse engineering and patching.
- **DevTools Lockdown**: Production environment disables DevTools, context menus, and debug shortcuts.

---

### Phase 2 - Multi-Device & Mobile (Upcoming)

- Multi-device sync
- Web dashboard
- Online reports

### Phase 3 - Multi-Store

- Android companion app
- Multi-store management
- Analytics dashboard

**All without rewriting core architecture.**

---

## Contributing

1. Create feature branch: `git checkout -b feature/product-search`
2. Make changes, commit: `git commit -m "feat: add product search"`
3. Push: `git push origin feature/product-search`
4. Create PR, get 1 approval
5. Squash and merge

**See [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for details.**

---

## License

MIT

---

## Support

- **Issues:** [GitHub Issues](https://github.com/princepsr/SmartKhata/issues)
- **Docs:** [docs/](docs/)
- **Logs:** `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\`

---

**Built with ❤️ for Indian kirana shops**
