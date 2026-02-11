# Administrative Key Generation Guide

This guide details how to use the `generate-key.js` script to create valid license keys for SmartKhata users.

## 1. Overview

The `generate-key.js` utility is an offline tool used by administrators to generate cryptographically signed license keys. These keys are "locked" to a specific computer using its unique **System ID**.

- **File Path**: `scripts/generate-key.js`
- **Format**: `KRN-XXXX-XXXX-XXXX`
- **Security**: Uses HMAC-SHA256 with a private `LICENSE_SECRET` environment variable.

## 2. Setup (Security)

Before generating keys, you must set your private secret. **Do not share this secret.**

1.  Create a `.env` file in the project root (copied from `.env.example`).
2.  Set `LICENSE_SECRET=your_secret_string`.
3.  Ensure the app is built/run with this same environment variable.

## 3. Usage Instructions

Run the script using Node.js from the project root:

```bash
# Set secret for the session (Windows PowerShell)
$env:LICENSE_SECRET="your_secret_string"
node scripts/generate-key.js <SYSTEM_ID> <YYYY-MM-DD>
```

### A. Using a Specific Date (Recommended)

This is the easiest way to set a fixed expiry date.

```bash
node scripts/generate-key.js <SYSTEM_ID> <YYYY-MM-DD>
```

_Example_: `node scripts/generate-key.js ABC123DEF456 2027-12-31`

### B. Using Number of Days

Sets the expiry relative to Jan 1, 2026.

```bash
node scripts/generate-key.js <SYSTEM_ID> <DAYS>
```

_Example_: `node scripts/generate-key.js ABC123DEF456 365` (Expires 365 days after Jan 1, 2026)

### C. Lifetime Access

Creates a key that never expires (valid until year 9999).

```bash
node scripts/generate-key.js <SYSTEM_ID> lifetime
# OR
node scripts/generate-key.js <SYSTEM_ID> 0
```

## 3. How it Works (Technical)

The generated 12-character key is a **Base32-encoded 60-bit number** containing:

1.  **Expiry (14 bits)**: Offset in days from 2026-01-01.
2.  **Device Binding (22 bits)**: A truncated hash of the unique System ID.
3.  **Signature (24 bits)**: An HMAC-SHA256 signature of the data above, using the app's secret key.

### Key Benefits:

- **Zero Internet Required**: The app validates the signature mathematically.
- **Human Friendly**: No `O`, `0`, `I`, or `1` characters to avoid typing errors.
- **Anti-Tamper**: Changing even one letter of the key makes the signature invalid.
- **Machine Locked**: Keys generated for one PC will not work on another.

---

> [!DANGER]
> **Keep your License Secret secure.**
> The secret is no longer stored in the source code. If you lose the secret, you cannot generate new keys, and existing keys will fail to verify if the app environment is cleared.
