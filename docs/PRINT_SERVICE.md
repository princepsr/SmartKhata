# Print Service & Receipt Formatting

## Overview

The `PrintService` is a robust, singleton-based service responsible for all thermal printing operations in SmartKhata POS. It handles printer discovery, receipt formatting (HTML/CSS), silent printing via hidden Electron windows, and error management.

## Architecture

### Singleton Pattern

The service uses a singleton pattern to ensure:

- Only one print job runs at a time (preventing spooler conflicts).
- A single "warmed-up" hidden window is reused for performance (Window Pooling).
- Centralized configuration management.

### Window Pooling

To eliminate the ~200-500ms overhead of creating a new `BrowserWindow` for every print job, `PrintService` maintains a generic, hidden print window.

- **Initialization**: Created on app startup or first use.
- **Lifecycle**: Reused for subsequent jobs. only destroyed on app exit or excessive memory usage (tracked by `StabilityService`).
- **Resilience**: Automatically recreated if it crashes or is accidentally destroyed.

### Silent Printing

All receipts are printed silently (`silent: true`) to the user's configured thermal printer, bypassing the OS print dialog for a seamless POS experience.

---

## Thermal Templates

The service supports dynamic HTML generation for different paper sizes.

### 58mm (2-inch)

- **Width**: `54mm` printable area.
- **Columns**: 32 characters (approx).
- **Layout**: Two-line item format.
  ```text
  Parle-G 80g
  5 x 10.00           50.00
  ```

### 80mm (3-inch)

- **Width**: `78mm` printable area.
- **Columns**: 48 characters (approx).
- **Layout**: Single-line tabular format.
  ```text
  Parle-G 80g      5   10.00   50.00
  ```

### Common Features

- **Header**: Shop Name, Address, Phone, GSTIN.
- **Footer**: Thank you message, "Powered by SmartKhata".
- **Typography**: Monospaced fonts for numerical alignment.

---

## Error Handling

The service maps low-level Electron/OS printer errors to user-friendly messages via `PrinterError`.

| Error Code | User Message |
| due | Description |
| `offline` | "Please check the cable or network connection." |
| `out-of-paper` | "Printer is out of paper. Please refill it." |
| `busy` | "Printer is busy processing another job. Wait a moment." |
| `timeout` | "Print operation timed out after 30 seconds." |

---

## IPC Integration

### Channels

- `bill:print` (`billId: number`): Fetches bill data and prints receipt.
- `bill:reprint-last`: Fetches the most recent bill and prints it.
- `printer:list`: Returns list of available system printers.
- `printer:testPrint` (`printerName: string`, `type: '58mm' | '80mm'`): Sends a test receipt.

### Data Flow (Bill Print)

1. **UI**: triggers `bill:print(123)`.
2. **IPC Handler**: Calls `PrintService.printBill(123)`.
3. **PrintService**:
   - Fetches bill details from `BillingService`.
   - Generates HTML based on configured `paperSize`.
   - Loads HTML into hidden window.
   - Waits for layout (100ms).
   - Calls `webContents.print()`.
4. **Response**: Returns `success: true` to UI immediately (async).

---

## Configuration

Settings are stored in the `app_config` table and cached in `SettingsService`.

- **printerName**: Target system printer device name.
- **paperSize**: `58mm` or `80mm`.
- **printCopies**: Number of copies (1-3).
- **autoPrint**: Whether to print automatically after sale creation.
