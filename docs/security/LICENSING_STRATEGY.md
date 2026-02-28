# Licensing & Anti-Tamper Architecture

SmartKhata implements a professional-grade, offline-first licensing system designed to prevent common trial-resetting and binary-patching attacks while maintaining a strictly local-first footprint.

---

## 1. Multi-Layered Trial Persistence (Redundancy)

To prevent users from resetting their trial by simply deleting the application database or AppData folder, the system maintains **quadruple redundancy** for the `trialStartedOn` marker:

| Location          | Path / Mechanism                              | Purpose                                      |
| ----------------- | --------------------------------------------- | -------------------------------------------- |
| **Database**      | `license` table                               | Primary record for application logic.        |
| **Hidden File 1** | `%APPDATA%/SmartKhata/.system_info/.t_marker` | Standard persistence.                        |
| **Hidden File 2** | `%LOCALAPPDATA%/.sys_data/.cache_bin`         | Obscure location for resilience.             |
| **Hidden File 3** | `~/.config/.sys_meta`                         | User-home level backup.                      |
| **Windows Reg**   | `HKCU:\Software\SmartKhata\SysData`           | Professional-grade persistence via RegEdit.  |

**Self-Healing Logic**: On startup, `LicenseService` reads all locations. It identifies the **Earliest** `trialStartedOn` and the **Latest** `lastSeenDate` (High-Water Mark), then synchronizes all locations.

---

## 2. Anti-Time-Tamper (High-Water Mark)

The system is immune to "Clock Rollbacks":
- **Mechanism**: The system records the `updatedAt` (Last Seen) timestamp in all redundant markers every time the app runs.
- **Enforcement**: If the Current System Time is *earlier* than the `lastSeenDate`, the app detects a "Clock Tamper" and uses the `lastSeenDate` as the authoritative current time for expiry calculation. This effectively "freezes" the license timer until the real-world time catches up.

---

## 3. Hardware Fingerprinting (Device Binding)

Licenses are strictly bound to the physical hardware. The `System ID` is a SHA-256 hash of:
1.  **Disk Serial**: Primary drive serial (via `wmic diskdrive`).
2.  **CPU Profile**: Exact model string + logical core count.
3.  **OS Profile**: Platform (win32) + Architecture (x64).

**Stability Note**: The fingerprint is stable across OS reboots. Only motherboard or primary disk replacement triggers a re-activation.

---

## 4. Cryptographic Short Keys (KRN-XXXX-XXXX-XXXX)

SmartKhata uses a **60-bit Bitwise Encoding** scheme for its 12-character license keys to ensure high density and security without requiring internet activation.

### Bitwise Mapping (60 Bits Total)
- **Bits 46-59 (14 bits)**: `ExpiryDays` (Days since 2026-01-01).
- **Bits 24-45 (22 bits)**: `DeviceHashID` (Truncated SHA-256 of the Hardware Fingerprint).
- **Bits 0-23 (24 bits)**: `Signature` (HMAC-SHA256 signature).

---

## 5. Expiry Lifecycle & Grace Handling

To prevent sudden workflow interruptions, the system provides a **3-day grace period** for non-bill-count expirations.

### Escalation Flow

| Phase        | Trigger               | System State      | Intrusiveness |
| :----------- | :-------------------- | :---------------- | :------------ |
| **Warning**  | `< 7 Days Remaining`  | Full-Access       | Toast Warning |
| **Critical** | `< 24 Hours Remaining`| Full-Access       | Splash Modal  |
| **Grace**    | `0 to -3 Days`        | **Full-Access**   | Persistent Red Banner |
| **Lock**     | `> 3 Days Late`       | **Read-Only**     | Blocking Lock Screen |
| **Volume**   | `Bills > 300 (Trial)` | **Read-Only**     | Immediate (No Grace) |

**Read-Only State**: Users can still view history, export reports, and backup data, but cannot create new sales, products, or customers.

---

**Last Updated**: 2026-02-28
**Primary Files**: `src/main/services/license-service.ts`, `src/shared/types/license.ts`
