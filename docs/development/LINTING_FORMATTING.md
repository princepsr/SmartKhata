# ESLint & Prettier Configuration

## Overview

SmartKhata uses ESLint for linting and Prettier for code formatting, with minimal rules focused on consistency rather than perfection.

---

## Configuration Files

```
SmartKhata/
├── eslint.config.js       # ESLint flat config (ESLint 9+)
├── .prettierrc            # Prettier formatting rules
└── .prettierignore        # Files to skip formatting
```

---

## ESLint Configuration

### File: `eslint.config.js`

**Type:** Flat config (ESLint 9+ format)

### Plugins Used

| Plugin | Purpose |
|--------|---------|
| `@eslint/js` | Core JavaScript rules |
| `typescript-eslint` | TypeScript-specific rules |
| `eslint-plugin-react-hooks` | React Hooks rules |
| `eslint-plugin-react-refresh` | Vite HMR compatibility |

### Key Rules (Minimal Strictness)

#### TypeScript Rules

```javascript
'@typescript-eslint/no-unused-vars': 'warn',  // Warn on unused vars
'@typescript-eslint/no-explicit-any': 'warn',  // Warn on 'any' type
'@typescript-eslint/explicit-module-boundary-types': 'off',  // Don't require return types
'@typescript-eslint/no-non-null-assertion': 'warn',  // Warn on '!' assertions
```

**Rationale:**
- Warnings instead of errors (less disruptive)
- Allow `any` type when needed (can tighten later)
- No forced return type annotations (TypeScript infers most)

#### General Rules

```javascript
'no-console': ['warn', { allow: ['warn', 'error'] }],  // Allow console.warn/error
'prefer-const': 'warn',  // Prefer const over let
'no-var': 'error',  // No var keyword
'eqeqeq': ['error', 'always'],  // Require === instead of ==
'curly': ['error', 'all'],  // Require curly braces
```

**Rationale:**
- Focus on common bugs (== vs ===, var usage)
- Allow console.warn/error for debugging
- Enforce modern JavaScript practices

#### React Rules

```javascript
...reactHooks.configs.recommended.rules,  // React Hooks rules
'react-refresh/only-export-components': 'warn',  // HMR compatibility
```

---

## Prettier Configuration

### File: `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Key Options

| Option | Value | Why |
|--------|-------|-----|
| `semi` | `true` | Use semicolons (consistency) |
| `singleQuote` | `true` | Single quotes for strings |
| `tabWidth` | `2` | 2-space indentation |
| `printWidth` | `100` | Max line length 100 chars |
| `trailingComma` | `es5` | Trailing commas in objects/arrays |
| `endOfLine` | `lf` | Unix-style line endings |

**Rationale:**
- Consistent with modern JavaScript conventions
- 100 char width (readable on most screens)
- Single quotes (less visual noise)

---

## Package Scripts

### Linting

```bash
# Check for linting errors
pnpm lint

# Auto-fix linting errors
pnpm lint:fix
```

### Formatting

```bash
# Format all files
pnpm format

# Check if files are formatted
pnpm format:check
```

### Type Checking

```bash
# Check all TypeScript files
pnpm type-check

# Check main process only
pnpm type-check:main

# Check renderer only
pnpm type-check:renderer
```

### Combined Check (Pre-commit)

```bash
# Run all checks
pnpm lint && pnpm format:check && pnpm type-check
```

---

## IDE Integration (VS Code)

### Recommended Extensions

Install these VS Code extensions:

1. **ESLint** (`dbaeumer.vscode-eslint`)
2. **Prettier - Code formatter** (`esbenp.prettier-vscode`)

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

**What this does:**
- Auto-format on save (Prettier)
- Auto-fix ESLint errors on save
- Use workspace TypeScript version

---

## Installation

### Install Dependencies

```bash
# Install all dev dependencies
pnpm install

# Or install individually
pnpm add -D eslint prettier typescript-eslint @eslint/js globals
pnpm add -D eslint-plugin-react-hooks eslint-plugin-react-refresh
```

---

## Usage Examples

### Before Commit

```bash
# 1. Format code
pnpm format

# 2. Fix linting issues
pnpm lint:fix

# 3. Check types
pnpm type-check

# 4. Commit if all pass
git add .
git commit -m "feat: add product search"
```

### Ignoring Rules (When Necessary)

```typescript
// Ignore next line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = fetchData();

// Ignore entire file (use sparingly)
/* eslint-disable @typescript-eslint/no-explicit-any */
```

---

## Customizing Rules

### Making Rules Stricter (Later)

When ready for stricter linting:

```javascript
// eslint.config.js
rules: {
  '@typescript-eslint/no-unused-vars': 'error',  // Error instead of warn
  '@typescript-eslint/no-explicit-any': 'error',  // Disallow 'any'
  '@typescript-eslint/explicit-module-boundary-types': 'warn',  // Require return types
}
```

### Adding Custom Rules

```javascript
// eslint.config.js
rules: {
  'no-debugger': 'error',  // Disallow debugger statements
  'no-alert': 'warn',  // Warn on alert() usage
  'max-lines': ['warn', 300],  // Warn on files > 300 lines
}
```

---

## Pre-commit Hooks (Optional)

### Using Husky + lint-staged

```bash
# Install
pnpm add -D husky lint-staged

# Setup
npx husky init
```

**`.husky/pre-commit`:**
```bash
#!/bin/sh
pnpm lint-staged
```

**`package.json`:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**What this does:**
- Auto-format and lint files before commit
- Only checks staged files (fast)

---

## Troubleshooting

### ESLint Not Working in VS Code

1. Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
2. Check ESLint output: `View` → `Output` → Select "ESLint"
3. Ensure ESLint extension is installed

### Prettier Conflicts with ESLint

- Our setup avoids conflicts (Prettier handles formatting, ESLint handles logic)
- If conflicts occur, disable ESLint formatting rules:

```bash
pnpm add -D eslint-config-prettier
```

```javascript
// eslint.config.js
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // ... other configs
  prettier,  // Disable conflicting rules
);
```

---

## Summary

| Tool | Purpose | Config File |
|------|---------|-------------|
| **ESLint** | Code quality, bug prevention | `eslint.config.js` |
| **Prettier** | Code formatting | `.prettierrc` |
| **TypeScript** | Type checking | `tsconfig.*.json` |

**Philosophy:**
- ✅ Minimal rules (avoid over-strict linting)
- ✅ Focus on consistency, not perfection
- ✅ Warnings over errors (less disruptive)
- ✅ Can tighten rules later as team matures

---

**Last updated:** 2026-02-08
