# Grace Handling Plan

Defines the behavior and escalation flow for license and trial expiration.

## Logic Overview

The system provides a **3-day grace period** after the formal expiration date to prevent sudden workflow interruptions for legitimate users.

### 1. Hard Lock Triggers

- **Trial Days**: 30 days + 3 days grace.
- **Paid License**: Expiry Date + 3 days grace.
- **Trial Bills**: 300 bills (No grace—immediate lock once reached to prevent volume abuse).

### 2. Escalation Flow

| Phase        | Duration              | System State   | Message Tone                |
| :----------- | :-------------------- | :------------- | :-------------------------- |
| **Warning**  | 7 days to expiry      | Functional     | Informative                 |
| **Critical** | 1 day to expiry       | Functional     | Urgent but polite           |
| **Grace**    | Days 1-3 after expiry | **Functional** | Warning of imminent lockout |
| **Lock**     | 3+ days after expiry  | **Read-Only**  | Verification required       |

## Implementation

- **LicenseService**: `GRACE_DAYS = 3` constant applied to `isLocked` logic.
- **IPC Handler**: `isGracePeriod` flag passed to frontend.
- **UI Banner**: Dynamic countdown message: "Please verify within X days to avoid interruption."
