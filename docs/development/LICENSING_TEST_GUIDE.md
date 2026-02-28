# Manual Verification Guide: Licensing & Trial (T2.5)

This guide provides steps to verify the robustness and security of the licensing system.

## 1. Initial State (New Installation)

1. **Action**: Clear `%APPDATA%/SmartKhata` (Warning: deletes data).
2. **Action**: Start the application.
3. **Verify**:
   - [ ] Blue banner appears: "Evaluation: 30 days / 300 bills remaining."
   - [ ] Clicking "License Details" shows a 32-character System ID.
   - [ ] You can create a bill, add a product, and view reports.

## 2. Trial Expiry - Usage Limit (300 Bills)

1. **Action**: Use a script or manually create 300+ bills in the DB.
2. **Verify**:
   - [ ] Banner turns red: "Evaluation period ended..."
   - [ ] Trying to "Save Bill" or "Add Product" results in a popup error.
   - [ ] Reports and History remain accessible (Read-Only).

## 3. Trial Expiry - Time Limit (30 Days)

1. **Action**: Close the app. Advance system clock by 31 days. Restart app.
2. **Verify**:
   - [ ] Banner enters "Grace Period" (Day 31-33) or "Locked" (Day 34+).
   - [ ] If in Grace: "Evaluation ended. Please verify within X days..." (Functional).
   - [ ] If Locked: "Evaluation period ended..." (Restricted).

## 4. Anti-Tamper: Clock Rollback

1. **Action**: Set clock forward 5 days. Run app. Close app. Set clock back to today. Restart app.
2. **Verify**:
   - [ ] App detects clock manipulation.
   - [ ] Restricted access until clock is synchronized.

## 5. Offline Activation Flow

1. **Action**: Copy System ID from Modal.
2. **Action**: Run the generator script: `node scripts/generate-key.js <ID> 365`.
3. **Action**: Paste the 12-character key (e.g., `KRN-ABCD-1234-EFGH`) into the modal.
4. **Verify**:
   - [ ] Success message: "Verification complete."
   - [ ] Banner disappears (or shows "License valid for 364 days").

## 6. Security: Negative Tests

1. **Action**: Enter a random 12-digit number.
   - [ ] **Verify**: Rejection with "Invalid license key signature."
2. **Action**: Enter a key generated for a _different_ PC.
   - [ ] **Verify**: Rejection with "License is bound to a different machine."
3. **Action**: Enter a key that is already expired.
   - [ ] **Verify**: Rejection with "License has expired."
