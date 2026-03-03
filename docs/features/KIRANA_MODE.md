# Kirana & Grocery Mode Technical Architecture

SmartKhata's **Kirana Mode** is optimized for high-volume retail environments where loose items, weighing scales, and rapid-checkout are critical. This document covers the hardware integration, unit math, and UI heuristics unique to this mode.

---

## 1. Weighing Scale Integration (Serial Protocol)

SmartKhata supports direct hardware integration with electronic weighing scales (e.g., Eagle, Phoenix, Essae) via the RS-232 serial interface.

### Connection Parameters

- **Baud Rate**: 9600 (Standard for most Indian industrial scales).
- **Data Bits**: 8.
- **Stop Bits**: 1.
- **Parity**: None.

### Stream Parsing Engine

The `KiranaService.parseWeighingScaleData` uses a specialized Regex-based parser to normalize heterogeneous scale payloads:

- **Identifier**: `([\d.]+)\s*(kg|g)/i`
- **Logic**: It extracts numerical values and unit suffixes. To ensure consistency, all "Gram" inputs are converted to "Kilogram" using the `convertToKg` helper before being passed to the Billing Service.
- **Stability Guard**: The UI only updates the quantity field when the scale reports a "Stable" (ST) status prefix, preventing flickering while the item is being placed on the pan.

---

## 2. Floating-Point Precision (Gram-to-Kg Math)

Accounting for loose items (e.g., "0.255 kg") requires extreme precision to prevent financial leakage.

- **The Problem**: Standard JavaScript floating-point arithmetic (e.g., `0.1 + 0.2`) often results in precision drift (e.g., `0.30000000000000004`).
- **The Solution**: SmartKhata uses **3-decimal normalization** for all weight-based arithmetic.
  - **Storage**: Weights are stored as floats in SQLite, but arithmetic is wrapped in the `Math.round(val * 1000) / 1000` pattern.
  - **UI/Price Sync**: The price is calculated using the rounded visible weight (e.g., `1.796 kg`) rather than the raw scale payload (e.g., `1.7962 kg`), ensuring total transparency on receipts.
  - **Scale-Compatible UI**: Weight inputs automatically trigger rounding on blur, and manual `+/-` buttons are disabled for weight-based items to prevent accidental tampering with scale-derived values.

---

## 3. Quick-Pick & Loose Item Heuristics

In grocery environments, high-turnover items often lack barcodes. The system uses an automated "Quick-Pick" ranking engine.

- **Discovery Rule**: Items are automatically added to the Quick-Pick grid if they meet any of these criteria:
  1. `isWeightBased = 1` (Boolean flag).
  2. `barcode IS NULL` or `barcode = ''`.
- **Ranking**: Items are sorted by `frequency_of_use` (stored in the analytics table), ensuring that "Sugar" or "Milk" appear at the top of the one-tap grid.

---

## 4. WhatsApp EOD (End of Day) Automation

SmartKhata provides an automated daily summary for shop owners using the `whatsapp-web.js` bridge.

- **Data Aggregation**: At the end of a shift, `KiranaService` generates a JSON summary of:
  - **Total Cash/UPI/Credit** collections.
  - **Top 5 Moving Items** (to identify reorder needs).
  - **Low Stock Alerts** (filtered by per-product `low_stock_threshold`).
- **Trigger**: Can be automated via a background cron-job in the Main process if the PC is left on, otherwise manually triggered on application shutdown.

---

## Technical Reference

- **Core Service**: `src/main/services/kirana-service.ts`
- **Hardware Lib**: `electron-serialport` (Production transport).
- **Schema Mapping**: `products` table columns (`is_weight_based`).
