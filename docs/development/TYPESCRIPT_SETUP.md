# TypeScript Configuration

## Overview

SmartKhata uses a multi-config TypeScript setup with a shared base configuration and separate configs for the Electron main process and React renderer.

---

## Configuration Files

```
SmartKhata/
├── tsconfig.json              # Root config (references main + renderer)
├── tsconfig.base.json         # Shared base configuration
├── tsconfig.main.json         # Electron main process
└── tsconfig.renderer.json     # React renderer
```

---

## 1. `tsconfig.base.json` - Shared Base Config

**Purpose:** Common compiler options used by both main and renderer

### Key Options

| Option | Value | Why |
|--------|-------|-----|
| `target` | `ES2020` | Modern JavaScript, supported by Electron & modern browsers |
| `module` | `ESNext` | Modern module system (overridden in main config) |
| `moduleResolution` | `bundler` | Works with Vite/Webpack (overridden in main config) |
| `strict` | `false` | Not overly strict initially (can enable later) |
| `jsx` | `react-jsx` | Modern React JSX transform (no `import React`) |
| `skipLibCheck` | `true` | Faster compilation, skip type checking in node_modules |

### Path Aliases

```json
"paths": {
  "@main/*": ["src/main/*"],
  "@renderer/*": ["src/renderer/*"],
  "@preload/*": ["src/preload/*"],
  "@shared/*": ["src/shared/*"],
  "@/types/*": ["src/shared/types/*"],
  "@/constants/*": ["src/shared/constants/*"],
  "@/utils/*": ["src/shared/utils/*"]
}
```

**Usage:**
```typescript
// Instead of: import { Product } from '../../../shared/types/product.types'
import { Product } from '@/types/product.types';

// Instead of: import { ProductService } from '../../services/product-service'
import { ProductService } from '@main/services/product-service';
```

---

## 2. `tsconfig.main.json` - Electron Main Process

**Purpose:** Configuration for Node.js/Electron main process

### Key Differences from Base

| Option | Value | Why |
|--------|-------|-----|
| `module` | `CommonJS` | Node.js uses CommonJS modules |
| `moduleResolution` | `node` | Node.js module resolution |
| `types` | `["node"]` | Include Node.js type definitions |
| `lib` | `["ES2020"]` | No DOM types (server-side only) |

### Includes
- `src/main/**/*` - Main process code
- `src/shared/**/*` - Shared types/utils
- `src/preload/**/*` - Preload scripts

### Excludes
- `src/renderer/**/*` - Cannot import renderer code

---

## 3. `tsconfig.renderer.json` - React Renderer

**Purpose:** Configuration for React UI (browser context)

### Key Differences from Base

| Option | Value | Why |
|--------|-------|-----|
| `module` | `ESNext` | Modern ES modules for bundlers |
| `moduleResolution` | `bundler` | Vite/Webpack module resolution |
| `lib` | `["ES2020", "DOM", "DOM.Iterable"]` | Browser APIs + DOM types |
| `jsx` | `react-jsx` | React 17+ JSX transform |
| `types` | `["vite/client"]` | Vite type definitions |

### Includes
- `src/renderer/**/*` - React UI code
- `src/shared/**/*` - Shared types/utils

### Excludes
- `src/main/**/*` - Cannot import main process code
- `src/preload/**/*` - Cannot import preload code

---

## 4. `tsconfig.json` - Root Config

**Purpose:** IDE support and project-wide type checking

### Project References

```json
"references": [
  { "path": "./tsconfig.main.json" },
  { "path": "./tsconfig.renderer.json" }
]
```

This enables:
- Parallel type checking of main and renderer
- Better IDE performance
- Correct cross-project references

---

## Path Alias Configuration

### In TypeScript

Path aliases are defined in `tsconfig.base.json`:

```json
"baseUrl": ".",
"paths": {
  "@main/*": ["src/main/*"],
  "@renderer/*": ["src/renderer/*"],
  "@shared/*": ["src/shared/*"],
  "@/types/*": ["src/shared/types/*"]
}
```

### In Build Tools

**Important:** Build tools (Vite, Webpack) need separate alias configuration.

**Vite example (for renderer):**
```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@/types': path.resolve(__dirname, 'src/shared/types'),
      '@/constants': path.resolve(__dirname, 'src/shared/constants'),
      '@/utils': path.resolve(__dirname, 'src/shared/utils'),
    }
  }
});
```

**Webpack example (for main):**
```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@/types': path.resolve(__dirname, 'src/shared/types'),
    }
  }
};
```

---

## Strictness Settings

### Current Settings (Moderate)

```json
"strict": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true
```

**Rationale:**
- Not overly strict for initial development
- Prevents common bugs (implicit returns, switch fallthrough)
- Can enable stricter checks later

### Future: Enabling Strict Mode

When ready for stricter type checking:

```json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true
```

**Benefits:**
- Catches more bugs at compile time
- Better code quality
- Easier refactoring

**Migration path:**
1. Enable `strict: true`
2. Fix errors incrementally (use `// @ts-ignore` temporarily if needed)
3. Enable `noUnusedLocals` and `noUnusedParameters`

---

## Usage Examples

### Importing Shared Types

```typescript
// ✅ Good - using path alias
import { Product, Sale } from '@/types/product.types';
import { IPC_EVENTS } from '@/constants/ipc-events';

// ❌ Bad - relative paths
import { Product } from '../../../shared/types/product.types';
```

### Main Process Imports

```typescript
// src/main/ipc-handlers/product-handlers.ts
import { ProductService } from '@main/services/product-service';
import { Product } from '@/types/product.types';
import { IPC_EVENTS } from '@/constants/ipc-events';
```

### Renderer Imports

```typescript
// src/renderer/pages/BillingPage/BillingPage.tsx
import { useProducts } from '@renderer/hooks/useProducts';
import { ProductSearch } from '@renderer/components/ProductSearch';
import { Product } from '@/types/product.types';
```

---

## Type Checking Commands

```bash
# Check all TypeScript files
pnpm tsc --noEmit

# Check main process only
pnpm tsc --project tsconfig.main.json --noEmit

# Check renderer only
pnpm tsc --project tsconfig.renderer.json --noEmit

# Watch mode (for development)
pnpm tsc --watch --noEmit
```

---

## IDE Setup (VS Code)

### Recommended Extensions

- **ESLint** - Linting
- **Prettier** - Code formatting
- **TypeScript Vue Plugin (Volar)** - Better TypeScript support

### Workspace Settings

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## Summary

| Config | Purpose | Module System | Includes |
|--------|---------|---------------|----------|
| `tsconfig.base.json` | Shared options | ESNext | - |
| `tsconfig.main.json` | Main process | CommonJS | main, shared, preload |
| `tsconfig.renderer.json` | React UI | ESNext | renderer, shared |
| `tsconfig.json` | Root/IDE | - | All (via references) |

**Key Benefits:**
- ✅ Path aliases work across all layers
- ✅ Separate compilation for main and renderer
- ✅ Shared types between processes
- ✅ Not overly strict (can tighten later)
- ✅ IDE autocomplete and type checking

---

**Last updated:** 2026-02-08
