# Localization Guide

SmartKhata uses a robust localization system to support multiple languages, primarily focusing on English and Hindi. This guide explains the technical implementation and how to add new translations.

## Tech Stack

- **[react-i18next](https://react.i18next.com/)**: The React wrapper for i18next.
- **[i18next](https://www.i18next.com/)**: The core internationalization framework.

## File Structure

All localization files are located in `src/renderer/i18n`:

- `config.ts`: i18next initialization and configuration.
- `locales/`: Contains JSON files for each supported language.
  - `en.json`: English translations (Source of Truth).
  - `hi.json`: Hindi translations.

## Usage in Components

### 1. `useTranslation` Hook

The primary way to use translations in functional components is the `useTranslation` hook.

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.dashboard')}</h1>
      <button>{t('inventory.add_product')}</button>
    </div>
  );
};
```

### 2. Namespace and Keys

We use nested keys to organize translations by module or context:

- `common`: Generic strings (Save, Cancel, Error, Success).
- `billing`: Sales and billing-related strings.
- `inventory`: Product and stock management.
- `license`: Licensing and activation strings.

### 3. Dynamic Values (Interpolation)

Use interpolation for dynamic data within strings:

**JSON:**

```json
"stock_qty_msg": "\"{{name}}\" has only {{qty}} remaining."
```

**Code:**

```tsx
t('billing.stock_qty_msg', { name: product.name, qty: product.stockQty });
```

## Adding New Translations

1. **Add Key to `en.json`**: Always add the English version first.
2. **Translate in `hi.json`**: Add the same key with the Hindi translation.
3. **Use in UI**: Reference the key using `t('namespace.key')`.

> [!TIP]
> Use a flat key structure where possible for simpler access, but maintain nesting for logical grouping of related features.

## Language Switching

Language state is managed via `useAppSettingsStore`. When a user changes the language in **Settings**, the store updates, and the i18n instance is automatically notified:

```tsx
// Inside SettingsPage.tsx
const handleLanguageChange = (lang: string) => {
  updateSettings({ language: lang });
  i18n.changeLanguage(lang);
};
```

## Best Practices

- **No Hardcoded Strings**: Never use literal strings in JSX (except for development placeholders).
- **Concise Keys**: Keep key names descriptive but short.
- **Avoid Over-translation**: Some technical terms (like "GST" or "SKU") might be better left in English or transliterated in Hindi for clarity in a POS context.
- **Contextual Translation**: Ensure Hindi translations sound natural in a business context (e.g., using "सेव करें" instead of "सहेजें" as per user preference).
