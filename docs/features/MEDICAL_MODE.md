# Medical Mode (Pharmacy) Technical Architecture

SmartKhata includes a deeply specialized **Medical Mode** designed for Indian Pharmacies and Chemists. This document details the technical implementation, data structures, and compliance logic for pharmaceutical operations.

---

## 1. Drug Dictionary & Salt Search Engine

SmartKhata maintains a high-performance in-memory dictionary to facilitate salt-based substitutions and generic brand mapping.

- **Storage**: `src/shared/data/indian-salts.ts`.
- **Data Structure**: A flat array of ~1,100 strings representing standardized INN (International Nonproprietary Names) used in the Indian market.
- **Search Logic**: Uses a case-insensitive `string.prototype.includes()` filter on the `INDIAN_SALTS` array.
- **Generic Alternatives Strategy**: 
  - **Query**: `SELECT * FROM products WHERE salt_name = ? AND isActive = 1 AND id != ?`
  - **Execution**: Triggered when a product is clicked in the Billing POS. The results are ranked by `current_stock` descending to suggest available alternatives first.

---

## 2. Fractional Unit Arithmetic (Tablet Math)

Pharmacies purchase by the "Strip" but often sell by the "Tablet". To prevent rounding errors and inventory drift, SmartKhata uses a **Base-Unit-Only** tracking model.

### Key Variables
- `total_units`: The absolute number of pieces (tablets/vials) in stock.
- `strip_size`: The packaging divisor (e.g., 10 for a strip of 10 tablets).

### Algorithm: Sale Deduction
The system converts all input into base units before subtracting from inventory:
`UnitsToDeduct = (StripsSelected * strip_size) + LooseTabletsSelected`

### Algorithm: Visual Formatting
To display "1 Strip, 5 Tablet" instead of "15", the following integer math is applied in the UI layer:
- **Full Strips**: `Math.floor(total_units / strip_size)`
- **Remaining Tablets**: `total_units % strip_size`

---

## 3. Scheduled Drug Compliance (Legal Guards)

Based on the **Drugs and Cosmetics Rules, 1945 (India)**, the system enforces non-dismissible UI warnings via the `MedicalService`.

| Category | Legal Rule | System Behavior |
|----------|------------|-----------------|
| **Schedule H** | Rx Only | Persistent Banner: "Prescription of RMP required." |
| **Schedule H1** | Register Required | Warning: "Maintain H1 Register Entry for this batch." |
| **Schedule X** | Narcotic / Psychotropic | Critical Modal: "Verify triple-check prescription & record ID." |

---

## 4. Batch & Expiry Intelligence

Unlike generic retail, medical items are tracked via **Batch Heuristics**.

- **Schema Constraints**:
  - `batch_number`: TEXT. Crucial for drug recall scenarios.
  - `expiry_date`: TEXT (ISO). Normalized to the last day of the month if only MM/YY is provided.
- **Near-Expiry Logic**: The `ReportService` queries `expiry_date` against `CURRENT_DATE + 60 days`.
- **Safety Blocks**: The Billing Service automatically filters out items where `expiry_date < today`, preventing the illegal sale of expired medicines even if they are physically in stock.

---

## Technical Reference
- **Core Service**: `src/main/services/medical-service.ts`
- **Salt Database**: `src/shared/data/indian-salts.ts`
- **Schema Mapping**: `products` table columns (`salt_name`, `strip_size`, `expiry_date`).
