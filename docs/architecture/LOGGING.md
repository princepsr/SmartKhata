# Logging Architecture & Observability

SmartKhata implements a professional-grade logging system designed for high observability while strictly protecting user privacy. This document details the technical implementation and security constraints of the logging engine.

---

## 1. Governance & Format

All logs follow a standardized structured format to ensure easy parsing by diagnostic tools.

### Standardized Format
`[Timestamp] [Level] [Module] Message | {Structured JSON Data}`

### UTC+5.5 (IST) Enforcement
To prevent confusion in regions with multiple timezones, SmartKhata's logger **forces UTC+5.5 (Indian Standard Time)** timestamps regardless of the host machine's system time or locale setting. This is critical for reconciling sales reports with log entries.

---

## 2. Advanced PII Redaction Logic

SmartKhata uses a **Recursive Sanitization** algorithm to ensure that Personally Identifiable Information (PII) never touches the disk.

### Redacted Fields
The following keys are automatically replaced with `[REDACTED]` whenever they appear in log data:
- **Identity**: `customerName`, `customerEmail`, `clientName`.
- **Contact**: `customerPhone`.
- **Sensitive Payload**: `items`, `lineItems` (full transaction details are blocked from logs).
- **Security**: `password`, `token`, `secret`.

### Recursive Depth
The `sanitizeData()` method traverses objects and arrays recursively. If a service logs a complex DTO containing a `customerPhone` nested three levels deep, the logger will identify and redact it before serialization.

---

## 3. Log Hierarchy & Rotation

### Module Scoping
Each service creates a scoped logger using `logger.forModule('NAME')`. This allows developers to filter for `[DB]`, `[IPC]`, or `[LICENSE]` events specifically during troubleshooting.

### Intelligent Rotation
- **Retention**: Last 7 days.
- **Trigger**: Cleanup runs once per application boot.
- **Archive**: Logs older than 7 days are physically `unlinked` from the filesystem to save disk space.

### Environment Behavior
- **Development**: All logs above `DEBUG` level are mirrored to both the console and the daily log file. `DEBUG` logs are console-only to reduce file bloat.
- **Production**: All levels (excluding `DEBUG`) are written exclusively to the rotational log file.

---

## 4. Error Correlation

When an `Error` object is passed to `logger.error()`, the system automatically extracts and logs:
1.  **Message**: The primary error string.
2.  **Stack Trace**: The full execution stack for pinpointing the exact line in source code.
3.  **RequestId**: Correlated with the `IPCHandler` if the error occurred during an IPC call, allowing end-to-end tracing of a failed request.

---

## Technical Reference
- **Core Utility**: `src/main/utils/logger.ts`
- **Path Config**: `src/main/config/app-config.ts` (`logsPath`)
- **Sanitization Fields**: `logger.ts#L114`
