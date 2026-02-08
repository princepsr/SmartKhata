-- ============================================
-- LICENSE TABLE
-- ============================================
-- Purpose: Offline license enforcement and activation tracking
-- Version: 002
-- 
-- Key Design Decisions:
-- 1. Single license per installation (one row only)
-- 2. Machine fingerprint for hardware binding
-- 3. Offline verification (no server calls)
-- 4. Tamper-resistant (encrypted license key)
-- 
-- IMPORTANT: This provides basic offline license enforcement.
-- Determined users can bypass this. For critical protection,
-- consider additional obfuscation and code signing.

CREATE TABLE license (
  -- Primary Key (single row table)
  id INTEGER PRIMARY KEY CHECK(id = 1),
  -- Enforce single row: only id = 1 allowed
  
  -- License Key (encrypted/signed)
  license_key TEXT NOT NULL UNIQUE,
  -- Format: BASE64-encoded encrypted string
  -- Contains: expiry date, machine fingerprint, signature
  -- Example: "ABC123-DEF456-GHI789-JKL012"
  
  -- Activation Timestamp
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- When license was first activated
  
  -- Expiry Timestamp
  expires_at TEXT NOT NULL,
  -- When license expires (ISO 8601 format)
  -- Example: "2027-02-08 00:00:00"
  -- NULL = perpetual license (not recommended)
  
  -- Machine Fingerprint
  machine_fingerprint TEXT NOT NULL,
  -- Unique identifier for this machine
  -- Prevents license transfer to different machines
  -- Generated from: CPU ID, MAC address, motherboard serial
  
  -- Audit Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

-- No additional indexes needed (single row table)
-- Primary key automatically indexed

-- ============================================
-- SAMPLE DATA (Development Only)
-- ============================================

-- Example: Trial license (30 days)
INSERT OR IGNORE INTO license (id, license_key, expires_at, machine_fingerprint)
VALUES (
  1,
  'TRIAL-ABC123-DEF456-GHI789',
  datetime('now', '+30 days'),
  'DEV-MACHINE-FINGERPRINT-12345'
);

-- Example: Perpetual license (no expiry)
-- INSERT OR IGNORE INTO license (id, license_key, expires_at, machine_fingerprint)
-- VALUES (
--   1,
--   'FULL-XYZ789-UVW456-RST123',
--   '2099-12-31 23:59:59',  -- Far future date
--   'PROD-MACHINE-FINGERPRINT-67890'
-- );
