# Environment Configuration

## Overview

SmartKhata uses a simple, local-first configuration approach with compile-time constants and runtime environment detection. No cloud, no complex config files—just what's needed for a desktop POS app.

---

## Configuration Architecture

```
┌─────────────────────────────────────────────────────┐
│  Compile-time Constants (app-constants.ts)         │
│  - App name, version, IPC events                   │
│  - Business rules (currency, tax)                  │
│  - Validation rules                                │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Runtime Config (app-config.ts)                     │
│  - Environment detection (dev vs prod)             │
│  - File paths (database, logs, backups)            │
│  - Directory creation                              │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Environment Variables (.env) - OPTIONAL            │
│  - Sensitive data only (encryption keys)           │
│  - NOT used for basic config                       │
└─────────────────────────────────────────────────────┘
```

---

## 1. Compile-Time Constants

### File: `src/shared/constants/app-constants.ts`

**Purpose:** Values that never change at runtime

**What goes here:**
- App metadata (name, version, ID)
- IPC event channel names
- Business rules (currency, tax rates)
- Validation rules (max lengths, min/max prices)
- Database table names
- Error messages

**Example:**
```typescript
export const APP_CONSTANTS = {
  APP_NAME: 'SmartKhata',
  APP_VERSION: '0.1.0',
  
  DB_NAME: 'smartkhata.db',
  
  WINDOW: {
    MIN_WIDTH: 1024,
    MIN_HEIGHT: 768,
  },
  
  BUSINESS: {
    CURRENCY: 'INR',
    CURRENCY_SYMBOL: '₹',
    TAX_RATE: 0,
  },
} as const;
```

**Why shared?**
- Both main and renderer need these constants
- Type-safe (TypeScript `as const`)
- Single source of truth

---

## 2. Runtime Configuration

### File: `src/main/config/app-config.ts`

**Purpose:** Values that vary between dev and production

**What goes here:**
- Environment detection (`isDevelopment`, `isProduction`)
- File paths (database, logs, backups)
- User data directory
- App version (from Electron)

**Key Features:**

#### Environment Detection
```typescript
const isDevelopment = process.env.NODE_ENV !== 'production';
```

#### Database Path Logic
```typescript
// Development: ./dev-data/smartkhata.db (in project root)
// Production: C:\Users\<User>\AppData\Roaming\SmartKhata\data\smartkhata.db
```

**Why different paths?**
- **Dev:** Easy to inspect/delete database during development
- **Prod:** Follows Windows conventions, survives app updates

#### Automatic Directory Creation
```typescript
// Creates these directories on startup:
// - userData/
// - userData/data/
// - userData/logs/
// - userData/backups/
// - dev-data/ (dev only)
```

---

## 3. Environment Variables (.env)

### File: `.env` (optional, NOT committed)

**Purpose:** Sensitive data only (rarely needed)

**What goes here:**
- Database encryption keys (if added later)
- Printer-specific settings (if needed)
- API keys (if cloud sync added later)

**Example `.env`:**
```bash
# Optional - only if needed
DB_ENCRYPTION_KEY=your-secret-key-here
PRINTER_NAME=ThermalPrinter
```

**Loading .env (if needed):**
```bash
pnpm add dotenv
```

```typescript
// src/main/index.ts
import 'dotenv/config';
```

**Current approach:**
- ❌ NOT using .env files initially
- ✅ All config is code-based (simpler)
- ✅ Can add .env later if needed

---

## File Paths (Windows)

### Development

```
SmartKhata/                           # Project root
├── dev-data/
│   └── smartkhata.db                 # Dev database
├── src/
└── ...
```

### Production

```
C:\Users\<Username>\AppData\Roaming\SmartKhata\
├── data\
│   └── smartkhata.db                 # Production database
├── logs\
│   └── app.log                       # Application logs
└── backups\
    └── smartkhata_2026-02-08.db      # Database backups
```

**How to find user data path:**
```typescript
import { app } from 'electron';
console.log(app.getPath('userData'));
// Output: C:\Users\<Username>\AppData\Roaming\SmartKhata
```

---

## Usage Examples

### In Main Process

```typescript
// src/main/index.ts
import { configManager } from './config/app-config';
import { APP_CONSTANTS } from '@shared/constants/app-constants';

const config = configManager.getConfig();

console.log('Environment:', config.isDevelopment ? 'dev' : 'prod');
console.log('Database:', config.databasePath);
console.log('App Name:', APP_CONSTANTS.APP_NAME);

// Load database
const db = new Database(config.databasePath);
```

### In Renderer (via IPC)

```typescript
// src/renderer/services/config-api.ts
export async function getAppConfig() {
  return window.electron.invoke('app:getConfig');
}

// Usage in component
const config = await getAppConfig();
console.log('Version:', config.appVersion);
```

### In Shared Code

```typescript
// src/shared/utils/currency-utils.ts
import { APP_CONSTANTS } from '@/constants/app-constants';

export function formatCurrency(amount: number): string {
  return `${APP_CONSTANTS.BUSINESS.CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}
```

---

## Configuration Loading Flow

### Startup Sequence

```
1. Electron app starts
   ↓
2. src/main/index.ts loads
   ↓
3. ConfigManager initializes
   - Detects environment (NODE_ENV)
   - Gets user data path from Electron
   - Creates required directories
   - Sets database path
   ↓
4. Main window created
   - Loads from localhost:5173 (dev)
   - Loads from dist/renderer/index.html (prod)
   ↓
5. App ready
```

---

## Security Considerations

### Desktop App Security

**What we do:**
- ✅ `contextIsolation: true` - Isolate renderer from Node.js
- ✅ `nodeIntegration: false` - No direct Node.js access in renderer
- ✅ Preload script - Controlled IPC bridge
- ✅ No sensitive data in renderer code

**What we DON'T need (local-only app):**
- ❌ API authentication (no server)
- ❌ HTTPS (no network requests)
- ❌ Environment variable encryption (no cloud)

**Future considerations (if cloud sync added):**
- Database encryption at rest
- Secure API key storage
- User authentication

---

## Changing Configuration

### Adding a New Constant

```typescript
// src/shared/constants/app-constants.ts
export const APP_CONSTANTS = {
  // ... existing constants
  
  BUSINESS: {
    // ... existing business rules
    MAX_DISCOUNT_PERCENT: 50,  // ← New constant
  },
} as const;
```

### Adding a New Runtime Config

```typescript
// src/main/config/app-config.ts
export interface AppConfig {
  // ... existing config
  maxBackups: number;  // ← New config
}

constructor() {
  this.config = {
    // ... existing config
    maxBackups: this.getEnv('MAX_BACKUPS', '10'),
  };
}
```

---

## Environment Detection

### How It Works

```typescript
// Set by build tools
process.env.NODE_ENV = 'development' | 'production'

// In code
const isDev = process.env.NODE_ENV !== 'production';
```

### Setting NODE_ENV

**Development:**
```bash
# Automatically set by Vite and electron
pnpm dev  # NODE_ENV=development
```

**Production:**
```bash
# Set during build
pnpm build  # NODE_ENV=production
```

**Manual override (testing):**
```bash
# Windows PowerShell
$env:NODE_ENV="production"; pnpm dev

# Windows CMD
set NODE_ENV=production && pnpm dev
```

---

## Troubleshooting

### Database not found

**Symptom:** App can't find database file

**Fix:**
```typescript
// Check database path
import { configManager } from './config/app-config';
console.log(configManager.get('databasePath'));

// Ensure directory exists
import fs from 'fs';
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
```

---

### Wrong environment detected

**Symptom:** Production app loads dev server

**Fix:**
```bash
# Ensure NODE_ENV is set during build
pnpm build  # Should set NODE_ENV=production

# Check in app
console.log('NODE_ENV:', process.env.NODE_ENV);
```

---

## Summary

| Aspect | Solution | File |
|--------|----------|------|
| **Compile-time constants** | `APP_CONSTANTS` | `src/shared/constants/app-constants.ts` |
| **Runtime config** | `ConfigManager` | `src/main/config/app-config.ts` |
| **Environment detection** | `process.env.NODE_ENV` | Automatic |
| **Database path** | Dev: `./dev-data/`, Prod: `AppData/Roaming/` | `app-config.ts` |
| **Sensitive data** | `.env` (optional) | `.env` (not committed) |

**Philosophy:**
- ✅ Simple, code-based configuration
- ✅ No complex config files
- ✅ Automatic directory creation
- ✅ Clear dev vs prod separation
- ✅ Secure enough for desktop app

---

**Last updated:** 2026-02-08
