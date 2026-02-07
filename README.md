# SmartKhata POS

**Local-first Kirana POS application for Windows**

A fast, offline-first point-of-sale system built for Indian kirana shops. No cloud dependency, no subscriptions—just reliable local billing with optional cloud sync later.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Electron 34 |
| **UI** | React 18 + TypeScript |
| **Build Tool** | Vite 6 |
| **Database** | SQLite (local file) |
| **Package Manager** | pnpm |
| **Linting** | ESLint + Prettier |

**Architecture:** Clean separation (UI → IPC → Services → Repositories → SQLite)

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

# Build
pnpm build            # Production build (main + renderer)
pnpm build:win        # Windows installer (NSIS + portable)
pnpm build:win:portable  # Portable .exe only

# Utilities
pnpm clean            # Remove build directories
```

**See [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md) for detailed workflow.**

---

## Project Status

**Current Phase:** T0.1 - Project Foundation & Architecture

### Completed ✅
- [x] Mono-repo structure with pnpm
- [x] TypeScript configuration (main, renderer, shared)
- [x] ESLint + Prettier (minimal rules)
- [x] Vite build setup
- [x] Environment configuration (dev vs prod)
- [x] File-based logging system
- [x] Git workflow & branching strategy

### In Progress 🚧
- [ ] Project initialization (`pnpm install`)
- [ ] SQLite database schema
- [ ] IPC communication layer
- [ ] Basic React UI components

### Upcoming 📋
- [ ] Billing screen
- [ ] Product management
- [ ] Inventory tracking
- [ ] Thermal printer support
- [ ] Database backup/restore

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
  ↓ (calls service)
IPC Service (renderer)
  ↓ (IPC call)
IPC Handler (main)
  ↓ (calls service)
Business Service
  ↓ (calls repository)
Repository
  ↓ (SQL query)
SQLite Database
```

**See [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) for details.**

---

## Database

**SQLite** (single file, local-only)

**Location:**
- Dev: `SmartKhata/dev-data/smartkhata.db`
- Prod: `C:\Users\<User>\AppData\Roaming\SmartKhata\data\smartkhata.db`

**Tables (MVP):**
- `products` - Product catalog
- `sales` - Sales records
- `sale_items` - Line items
- `customers` - Customer info
- `settings` - App settings

**See [database/schema.md](database/schema.md) for schema design.**

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

| Developer | Responsibility |
|-----------|---------------|
| **Dev 1** | Electron main process, IPC, printing |
| **Dev 2** | React UI, UX, components |
| **Dev 3** | Database, services, business logic |

**Workflow:** See [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)

---

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) | Tech choices, mono-repo, package manager |
| [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) | Complete folder breakdown |
| [TYPESCRIPT_SETUP.md](docs/TYPESCRIPT_SETUP.md) | TypeScript configs, path aliases |
| [LINTING_FORMATTING.md](docs/LINTING_FORMATTING.md) | ESLint + Prettier setup |
| [DEV_SCRIPTS.md](docs/DEV_SCRIPTS.md) | Development workflow, HMR, builds |
| [ENVIRONMENT_CONFIG.md](docs/ENVIRONMENT_CONFIG.md) | Config management, file paths |
| [LOGGING.md](docs/LOGGING.md) | Logging system usage |
| [GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) | Branching, PRs, merge strategy |

---

## Roadmap

### Phase 1 (Current) - Local-First MVP
- Windows desktop app
- SQLite database
- Offline billing
- Thermal printing
- Inventory management

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
