# SmartKhata

**Local-first Kirana application for Windows**

A fast, offline-first point-of-sale system built for Indian kirana shops.

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
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # IPC wrappers
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
5. **No overengineering** - Simple, boring solutions

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

## Database

**SQLite** (single file, local-only)

**Location:**

- Dev: `SmartKhata/dev-data/smartkhata.db`
- Prod: `C:\Users\<User>\AppData\Roaming\SmartKhata\data\smartkhata.db`

**Tables:**

- `products` - Product catalog
- `customers` - Customer info
- `bills` - Sales records
- `bill_items` - Line items
- `inventory_logs` - Stock change history
- `settings` - App settings (key-value)
- `license` - License information
- `schema_migrations` - Migration tracking

**See [docs/schema/](docs/schema/) for complete schema documentation.**

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
├── SmartKhata Setup 0.1.0.exe    # Installer
└── SmartKhata 0.1.0.exe          # Portable
```

### Portable Only (faster for testing)

```bash
pnpm build:win:portable
```

**See [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md) for build configuration.**

---

## Team Structure

| Developer | Responsibility                       |
| --------- | ------------------------------------ |
| **Dev 1** | Electron main process, IPC, printing |
| **Dev 2** | React UI, UX, components             |
| **Dev 3** | Database, services, business logic   |

**Workflow:** See [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)

---

## Documentation

### Core Architecture

| Document                                                    | Purpose                               |
| ----------------------------------------------------------- | ------------------------------------- |
| [CURRENT_ARCHITECTURE.md](docs/CURRENT_ARCHITECTURE.md)     | **Complete architecture overview**    |
| [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) | Tech choices, service layer, patterns |
| [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)             | Complete folder breakdown             |

### Service Layer

| Document                                                  | Purpose                                |
| --------------------------------------------------------- | -------------------------------------- |
| [SERVICE_LAYER_RULES.md](docs/SERVICE_LAYER_RULES.md)     | Service layer responsibilities & rules |
| [SERVICE_ERROR_FLOW.md](docs/SERVICE_ERROR_FLOW.md)       | Error handling & typed errors          |
| [IPC_SERVICE_MAPPING.md](docs/IPC_SERVICE_MAPPING.md)     | IPC to service communication           |
| [SERVICE_LAYER_TESTING.md](docs/SERVICE_LAYER_TESTING.md) | Testing strategy                       |
| [TESTING_GUIDE.md](docs/TESTING_GUIDE.md)                 | How to run and write tests             |

### Database & Repository

| Document                                                  | Purpose                       |
| --------------------------------------------------------- | ----------------------------- |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)             | Complete schema documentation |
| [REPOSITORY_RULES.md](docs/REPOSITORY_RULES.md)           | Repository pattern & rules    |
| [DATABASE_TRANSACTIONS.md](docs/DATABASE_TRANSACTIONS.md) | Transaction handling          |

### Development

| Document                                            | Purpose                           |
| --------------------------------------------------- | --------------------------------- |
| [TYPESCRIPT_SETUP.md](docs/TYPESCRIPT_SETUP.md)     | TypeScript configs, path aliases  |
| [LINTING_FORMATTING.md](docs/LINTING_FORMATTING.md) | ESLint + Prettier setup           |
| [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md)               | Development workflow, HMR, builds |
| [ENVIRONMENT_CONFIG.md](docs/ENVIRONMENT_CONFIG.md) | Config management, file paths     |
| [LOGGING.md](docs/LOGGING.md)                       | Logging system usage              |
| [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)             | Branching, PRs, merge strategy    |

---

## Roadmap

### Phase 1 (Current) - Local-First MVP

- Windows desktop app
- SQLite database
- Offline billing
- Thermal printing
- Inventory management

---

## Security & Licensing

SmartKhata includes a robust, offline-first licensing system:

- **Triple Redundancy**: License markers are stored in 3 obscure system locations + the Windows Registry to prevent trial reset by deleting folders.
- **Anti-Time-Travel**: Implements a "High-Water Mark" monotonic clock. If a user sets their system clock backward, the app detects it and usage time remains "frozen."
- **Cryptographic Binding**: All licenses are cryptographically signed and bound to the machine's unique hardware fingerprint.
- **Code Obfuscation**: Production builds are obfuscated using `javascript-obfuscator` to prevent reverse engineering and patching.
- **DevTools Lockdown**: Production environment disables DevTools, context menus, and debug shortcuts.

---

### Phase 2 - Cloud Sync (Optional)

- Cloud backup
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

- **Issues:** [GitHub Issues](https://github.com/your-org/SmartKhata/issues)
- **Docs:** [docs/](docs/)
- **Logs:** `C:\Users\<User>\AppData\Roaming\SmartKhata\logs\`

---

**Built with ❤️ for Indian kirana shops**
