# Icon Placeholder

This directory contains the application icons for SmartKhata.

## Required Icons

### Windows (.ico)

**File:** `icon.ico`

**Sizes required:**
- 16x16
- 32x32
- 48x48
- 64x64
- 128x128
- 256x256

**How to create:**
1. Design icon in 256x256 (PNG format)
2. Use online tool: https://icoconvert.com/
3. Upload PNG, select all sizes
4. Download as `icon.ico`
5. Place in `resources/icons/icon.ico`

**Design guidelines:**
- Simple, recognizable at small sizes
- Use SmartKhata brand colors
- Avoid fine details (won't show at 16x16)
- Test at all sizes

---

## Temporary Placeholder

Until a proper icon is created, electron-builder will use the default Electron icon.

**To add your icon:**
1. Create `icon.ico` (see above)
2. Place in `resources/icons/icon.ico`
3. Rebuild: `pnpm build:win`

---

## Icon Usage

### Application Icon
- **File:** `icon.ico`
- **Used for:** Taskbar, desktop shortcut, exe file icon
- **Configured in:** `package.json` → `build.win.icon`

### Installer Icon (Optional)
- **File:** `installerIcon.ico` (optional)
- **Used for:** NSIS installer icon
- **Configured in:** `package.json` → `build.nsis.installerIcon`

---

## Current Configuration

```json
{
  "build": {
    "win": {
      "icon": "resources/icons/icon.ico"
    }
  }
}
```

**Status:** ⚠️ Placeholder needed - using default Electron icon

---

## Design Inspiration

**POS App Icons:**
- Cash register symbol
- Receipt/bill icon
- Rupee symbol (₹)
- Shopping cart
- Barcode scanner

**Color suggestions:**
- Primary: Blue/Green (trust, finance)
- Accent: Orange/Yellow (energy, retail)

---

## Tools

**Free icon creation:**
- Canva (https://canva.com)
- Figma (https://figma.com)
- GIMP (https://gimp.org)

**ICO conversion:**
- https://icoconvert.com/
- https://convertio.co/png-ico/

---

**Last updated:** 2026-02-08
