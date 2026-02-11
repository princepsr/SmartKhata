const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Simple .env loader
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts
              .join('=')
              .trim()
              .replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value;
          }
        }
      });
    }
  } catch (e) {}
}

loadEnv();

/**
 * SmartKhata Offline License Key Generator
 *
 * Usage: node generate-key.js <device_id> <expiry_days> <secret_key>
 * - device_id: The unique system ID from the app
 * - expiry_days: Number of days from 2026-01-01 (0 = Lifetime)
 * - secret_key: The SMARTKHATA_LICENSE_SECRET_2026
 */

const B32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SECRET_KEY = process.env.LICENSE_SECRET || process.argv[4];

if (!SECRET_KEY) {
  console.error('\nError: LICENSE_SECRET not found.');
  console.log('Set it as an environment variable or pass it as the 3rd argument:');
  console.log('Usage: node generate-key.js <device_id> <expiry> [secret_key]\n');
  process.exit(1);
}

function getTruncatedHash(input, bitCount) {
  const hash = crypto.createHash('sha256').update(input).digest();
  const val = hash.readUInt32BE(0);
  return val >>> (32 - bitCount);
}

function generateShortSignature(expiry, deviceHashID) {
  const data = `SHORT:${expiry}:${deviceHashID}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(data);
  const hash = hmac.digest();
  return (hash[0] << 16) | (hash[1] << 8) | hash[2];
}

function encodeBase32(bits, length) {
  let str = '';
  for (let i = 0; i < length; i++) {
    const val = Number((bits >> BigInt(5 * (length - 1 - i))) & 0x1fn);
    str += B32_ALPHABET[val];
  }
  return str;
}

function generateKey(deviceId, expiryDays) {
  const deviceHashID = getTruncatedHash(deviceId, 22);
  const signature = generateShortSignature(expiryDays, deviceHashID);

  // Pack into 60 bits
  // Expiry (14 bits) | DeviceHashID (22 bits) | Signature (24 bits)
  let bits = (BigInt(expiryDays) << 46n) | (BigInt(deviceHashID) << 24n) | BigInt(signature);

  const rawKey = encodeBase32(bits, 12);

  // Format as KRN-XXXX-XXXX-XXXX
  return `KRN-${rawKey.substring(0, 4)}-${rawKey.substring(4, 8)}-${rawKey.substring(8, 12)}`;
}

// CLI Execution
if (process.argv.length < 4) {
  console.log('Usage: node generate-key.js <device_id> <expiry_days_or_date> [secret_key]');
  console.log('Examples:');
  console.log('  node generate-key.js ABC123DEF 365          (365 days from Jan 1, 2026)');
  console.log('  node generate-key.js ABC123DEF 2027-12-31   (Expires on specific date)');
  console.log('  node generate-key.js ABC123DEF 0            (Lifetime access)');
  process.exit(1);
}

const deviceId = process.argv[2];
const expiryInput = process.argv[3];
let expiryDays;

if (expiryInput === '0' || expiryInput.toLowerCase() === 'lifetime') {
  expiryDays = 0;
} else if (expiryInput.includes('-')) {
  // Parse as date (e.g., 2026-12-31)
  const targetDate = new Date(expiryInput + 'T23:59:59Z');
  if (isNaN(targetDate.getTime())) {
    console.error('Error: Invalid date format. Use YYYY-MM-DD');
    process.exit(1);
  }

  const epoch = new Date('2026-01-01T00:00:00Z');
  const diffTime = targetDate.getTime() - epoch.getTime();
  expiryDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (expiryDays < 0) {
    console.error('Error: Expiry date must be after January 1, 2026');
    process.exit(1);
  }
} else {
  // Parse as days
  expiryDays = parseInt(expiryInput, 10);
  if (isNaN(expiryDays)) {
    console.error('Error: Expiry must be a number of days or a date (YYYY-MM-DD)');
    process.exit(1);
  }
}

const key = generateKey(deviceId, expiryDays);

// Calculate human-readable date for confirmation
const epoch = new Date('2026-01-01T00:00:00Z');
const actualExpiry =
  expiryDays === 0
    ? 'Lifetime'
    : (() => {
        const d = new Date(epoch.getTime() + expiryDays * 24 * 60 * 60 * 1000);
        d.setSeconds(d.getSeconds() - 1); // Go back to 23:59:59 of previous day
        return d.toISOString().split('T')[0] + ' (Inclusive)';
      })();

console.log('\n--- SmartKhata License Key Generator ---');
console.log(`Device ID:      ${deviceId}`);
console.log(`Expiry Target:  ${actualExpiry}`);
console.log(`Key:            ${key}`);
console.log('----------------------------------------\n');
