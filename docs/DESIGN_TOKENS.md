# Design Tokens & Theming

## Overview

SmartKhata uses **CSS Custom Properties (CSS Variables)** as design tokens. This provides a simple, performant, and maintainable theming system without any framework dependencies.

---

## Token Definition

**File:** `src/renderer/index.css`

All design tokens are defined in the `:root` selector:

```css
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-success: #16a34a;
  /* ... more tokens */

  /* Typography */
  --font-size-base: 18px;
  --font-family: -apple-system, ...;

  /* Spacing */
  --spacing-md: 16px;

  /* Other */
  --radius-sm: 4px;
  --focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.5);
}
```

---

## Complete Token Reference

### Colors

#### Primary Colors

```css
--color-primary: #2563eb; /* Blue - Main brand color */
--color-primary-dark: #1e40af; /* Darker blue - Hover states */
```

**Usage:** Buttons, links, sidebar, focus indicators

---

#### Semantic Colors

```css
--color-success: #16a34a; /* Green - Success states */
--color-warning: #ea580c; /* Orange - Warnings */
--color-error: #dc2626; /* Red - Errors */
```

**Usage:** Status messages, validation, alerts

---

#### Background Colors

```css
--color-bg: #ffffff; /* White - Main background */
--color-bg-secondary: #f3f4f6; /* Light gray - Content area */
```

**Usage:** Page backgrounds, cards, sections

---

#### Text Colors

```css
--color-text: #111827; /* Near black - Primary text */
--color-text-secondary: #6b7280; /* Gray - Secondary text */
```

**Usage:** Body text, labels, helper text

---

#### Border Colors

```css
--color-border: #d1d5db; /* Gray - Borders */
```

**Usage:** Input borders, dividers, card outlines

---

### Typography

#### Font Family

```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

**System font stack:**

- Fast (no web font download)
- Native appearance
- Excellent readability

---

#### Font Sizes

```css
--font-size-sm: 16px; /* Small text, shortcuts */
--font-size-base: 18px; /* Body text, labels */
--font-size-lg: 22px; /* Important text, inputs */
--font-size-xl: 28px; /* Section headers */
--font-size-2xl: 36px; /* Page titles */
```

**Scale:** ~1.22x ratio

**POS Optimization:** Larger than typical web (14-16px base)

---

### Spacing

```css
--spacing-xs: 4px; /* Tight spacing */
--spacing-sm: 8px; /* Small gaps */
--spacing-md: 16px; /* Standard padding */
--spacing-lg: 24px; /* Section spacing */
--spacing-xl: 32px; /* Page padding */
```

**8px base grid:** Consistent rhythm, easy mental math

---

### Border Radius

```css
--radius-sm: 4px; /* Buttons, inputs */
--radius-md: 8px; /* Cards */
--radius-lg: 12px; /* Large cards */
```

**Subtle rounding:** Not too round, professional look

---

### Effects

#### Focus Ring

```css
--focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.5);
```

**Usage:** Keyboard focus indicator (accessibility)

---

## Using Design Tokens

### In CSS Files

```css
/* Component styles */
.button {
  background-color: var(--color-primary);
  color: white;
  font-size: var(--font-size-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-sm);
}

.button:hover {
  background-color: var(--color-primary-dark);
}

.button:focus-visible {
  box-shadow: var(--focus-ring);
}
```

**Benefits:**

- ✅ Consistent values across app
- ✅ Easy to update (change once, applies everywhere)
- ✅ No magic numbers
- ✅ Self-documenting

---

### In Inline Styles (Avoid)

```tsx
// ❌ Avoid inline styles
<div style={{ color: '#2563eb' }}>Text</div>

// ✅ Use CSS classes instead
<div className="text-primary">Text</div>

// ✅ If you must use inline styles, use tokens
<div style={{ color: 'var(--color-primary)' }}>Text</div>
```

**Recommendation:** Use CSS classes, not inline styles

---

### Accessing Tokens in JavaScript

```typescript
// Get computed value
const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');

console.log(primaryColor); // "#2563eb"

// Set token value dynamically
document.documentElement.style.setProperty('--color-primary', '#1e40af');
```

**Use case:** Dynamic theming, user preferences

---

## Theming Approach

### Light Theme (Default)

**Current implementation:**

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111827;
  /* ... light theme colors */
}
```

**This is the default and only theme for now.**

---

### Dark Theme (Future)

**Option 1: Media query**

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    --color-text: #f9fafb;
    --color-bg-secondary: #1f2937;
    --color-border: #374151;
    /* ... dark theme colors */
  }
}
```

**Pros:**

- Automatic based on system preference
- No JavaScript needed

**Cons:**

- Can't override user preference
- No toggle button

---

**Option 2: Class-based**

```css
/* Light theme (default) */
:root {
  --color-bg: #ffffff;
  --color-text: #111827;
}

/* Dark theme */
.dark-theme {
  --color-bg: #111827;
  --color-text: #f9fafb;
  --color-bg-secondary: #1f2937;
  --color-border: #374151;
}
```

**Usage:**

```tsx
// Toggle dark theme
document.documentElement.classList.toggle('dark-theme');
```

**Pros:**

- User can toggle manually
- Can persist preference to localStorage

**Cons:**

- Requires JavaScript

---

**Recommendation for POS:**

**Stick with light theme only.**

**Why?**

- POS environments are usually bright (shops, stores)
- Dark mode may reduce visibility under fluorescent lights
- Simpler codebase (one theme to maintain)
- Can add later if needed

---

## Token Organization

### Current Structure

```
src/renderer/index.css
└── :root
    ├── Colors (primary, semantic, backgrounds, text, borders)
    ├── Typography (family, sizes)
    ├── Spacing (xs to xl)
    ├── Border Radius (sm to lg)
    └── Effects (focus ring)
```

**Single file:** Simple, performant, easy to find

---

### Alternative: Separate Files (Not Recommended)

```
src/renderer/styles/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   └── effects.css
└── index.css (imports all)
```

**Why not?**

- More files to manage
- Extra HTTP requests (dev)
- Harder to see all tokens at once
- Overkill for this project

**Decision:** Keep all tokens in `index.css`

---

## Token Naming Convention

### Pattern

```
--{category}-{name}-{variant}
```

### Examples

```css
--color-primary           /* Base primary color */
--color-primary-dark      /* Darker variant */
--font-size-base          /* Base font size */
--font-size-lg            /* Large variant */
--spacing-md              /* Medium spacing */
```

### Rules

1. **Lowercase with hyphens** (kebab-case)
2. **Category first** (color, font, spacing)
3. **Descriptive names** (primary, not blue)
4. **Variants last** (dark, light, hover)

---

## Component Consumption

### Example: Button Component

**CSS:**

```css
/* src/renderer/components/Button.css */
.btn {
  /* Use tokens */
  font-size: var(--font-size-lg);
  font-weight: 600;
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.btn-primary:focus-visible {
  box-shadow: var(--focus-ring);
}

.btn-secondary {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
  border: 2px solid var(--color-border);
}
```

**Component:**

```tsx
// src/renderer/components/Button.tsx
import './Button.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

function Button({ variant = 'primary', children, onClick }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

**Usage:**

```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
```

---

### Example: Card Component

**CSS:**

```css
/* src/renderer/components/Card.css */
.card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: var(--font-size-xl);
  color: var(--color-text);
  margin-bottom: var(--spacing-md);
}

.card-content {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}
```

---

## Performance

### CSS Variables Performance

✅ **Fast:**

- Native browser feature
- No JavaScript overhead
- GPU-accelerated
- Instant updates

**Benchmark:**

- Changing a CSS variable: ~1ms
- Re-rendering affected elements: ~16ms (1 frame)

**Result:** Suitable for real-time theming

---

### Best Practices

```css
/* ✅ Good: Use tokens */
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-md);
}

/* ❌ Bad: Hardcoded values */
.button {
  background-color: #2563eb;
  padding: 16px;
}

/* ✅ Good: Fallback values */
.button {
  background-color: var(--color-primary, #2563eb);
}

/* ❌ Bad: No fallback (not critical but good practice) */
.button {
  background-color: var(--color-primary);
}
```

---

## Updating Tokens

### Changing a Token

**Before:**

```css
--color-primary: #2563eb;
```

**After:**

```css
--color-primary: #1e40af;
```

**Result:** All components using `var(--color-primary)` update instantly

---

### Adding a New Token

1. **Define in `:root`:**

```css
:root {
  --color-info: #0ea5e9; /* New token */
}
```

2. **Use in components:**

```css
.info-message {
  background-color: var(--color-info);
}
```

3. **Document in this file** (update token reference)

---

## Token Documentation

### Inline Comments

```css
:root {
  /* Primary brand color - used for buttons, links, sidebar */
  --color-primary: #2563eb;

  /* Success state - used for completed actions */
  --color-success: #16a34a;

  /* Base font size - optimized for POS readability */
  --font-size-base: 18px;
}
```

**Benefits:**

- Self-documenting
- Easy to understand purpose
- Helps future developers

---

## Testing Tokens

### Visual Regression Testing

```typescript
// Test that tokens are defined
test('design tokens are defined', () => {
  const root = document.documentElement;
  const primary = getComputedStyle(root).getPropertyValue('--color-primary');

  expect(primary).toBe('#2563eb');
});
```

---

### Manual Testing

**Checklist:**

- [ ] All colors have sufficient contrast (WCAG AAA)
- [ ] Font sizes are readable from 2 feet away
- [ ] Spacing is consistent across components
- [ ] Checkbox/Radio inputs have 0.25rem radius

---

## 🏗️ Premium Layout Patterns

### 1. Multi-Row View Header

Adopted from the Reporting module and standardized in Settings:

```css
/* Container 1: Metadata */
.header-row-static {
  padding: 1rem 1.5rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
}

/* Container 2: Navigation/Toolbar */
.header-row-toolbar {
  padding: 0 1.5rem 1.25rem 1.5rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
}
```

### 2. Premium Section Cards

```css
.section-card {
  background: var(--bg-panel);
  padding: 2.25rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.section-card::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--color-primary); /* Use color-warning for high-priority */
}
```

---

## Summary

| Aspect           | Implementation            | Rationale                     |
| ---------------- | ------------------------- | ----------------------------- |
| **Technology**   | CSS Custom Properties     | Native, fast, no dependencies |
| **Organization** | Single file (`index.css`) | Simple, easy to find          |
| **Naming**       | `--category-name-variant` | Consistent, descriptive       |
| **Theme**        | Light only (for now)      | POS environments are bright   |
| **Performance**  | Excellent (~1ms updates)  | Native browser feature        |
| **Maintenance**  | Easy (change once)        | Tokens used everywhere        |

**Key principle:** **Simple, performant, maintainable. No framework needed.**

---

## Quick Reference

### Most Used Tokens

```css
/* Colors */
var(--color-primary)
var(--color-success)
var(--color-error)
var(--color-bg)
var(--color-text)

/* Typography */
var(--font-size-base)
var(--font-size-lg)
var(--font-family)

/* Spacing */
var(--spacing-md)
var(--spacing-lg)

/* Effects */
var(--focus-ring)
```

---

**Last updated:** 2026-02-11  
**File:** `src/renderer/index.css`
