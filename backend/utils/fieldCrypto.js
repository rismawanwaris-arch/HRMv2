const crypto = require('crypto');

/**
 * Application-level encryption for sensitive candidate/employee columns.
 *
 * Enabled by setting DATA_ENCRYPTION_KEY (a long random string; a 64-char hex
 * value is used as raw key bytes, anything else is treated as a passphrase).
 * Two sub-keys are derived via HKDF:
 *   - an AES-256-GCM key for reversible field encryption
 *   - an HMAC-SHA256 key for deterministic "blind index" values, so a UNIQUE
 *     constraint and exact-match lookups still work on an encrypted column.
 *
 * When no key is configured every function is an identity/no-op passthrough,
 * so local development and existing plaintext databases keep working.
 */

const PREFIX = 'enc:v1:';

// Columns that hold PII and are encrypted at rest when a key is configured.
const ENCRYPTED_COLUMNS = [
  'nik', 'npwp', 'bank_account', 'bpjs_health', 'bpjs_employment',
  'health_history', 'allergies', 'medications',
];

const rawKey = process.env.DATA_ENCRYPTION_KEY || '';
let encKey = null;
let indexKey = null;

if (rawKey) {
  const master = /^[0-9a-fA-F]{64}$/.test(rawKey) ? Buffer.from(rawKey, 'hex') : Buffer.from(rawKey, 'utf8');
  encKey = Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), 'hrmv2-field-encryption', 32));
  indexKey = Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), 'hrmv2-blind-index', 32));
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[fieldCrypto] DATA_ENCRYPTION_KEY is not set — sensitive columns (NIK, NPWP, bank, health) are stored in plaintext.');
}

function isEnabled() {
  return encKey !== null;
}

/**
 * Encrypt a value for storage. Null/empty pass through unchanged; already
 * encrypted values are returned as-is.
 * @param {any} plaintext
 * @returns {string|null}
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext ?? null;
  if (!encKey) return plaintext;
  if (typeof plaintext === 'string' && plaintext.startsWith(PREFIX)) return plaintext;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/**
 * Decrypt a stored value. Non-encrypted values (legacy plaintext, null) are
 * returned unchanged.
 * @param {any} value
 * @returns {any}
 */
function decrypt(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  if (!encKey) return value;
  try {
    const parts = value.split(':'); // ['enc','v1', iv, tag, data]
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const data = Buffer.from(parts[4], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    console.error('[fieldCrypto] decrypt failed:', e.message);
    return value;
  }
}

/**
 * Deterministic keyed hash of a value, for UNIQUE constraints and exact-match
 * lookups on an encrypted column. Returns null when disabled or empty.
 * @param {any} plaintext
 * @returns {string|null}
 */
function blindIndex(plaintext) {
  if (!indexKey || plaintext === null || plaintext === undefined || String(plaintext).trim() === '') return null;
  return crypto.createHmac('sha256', indexKey).update(String(plaintext).trim()).digest('hex');
}

/**
 * Decrypt every known encrypted column present on a DB row (mutates and returns).
 * @param {Object|null|undefined} row
 */
function decryptRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const col of ENCRYPTED_COLUMNS) {
    if (col in row) row[col] = decrypt(row[col]);
  }
  return row;
}

module.exports = {
  PREFIX,
  ENCRYPTED_COLUMNS,
  isEnabled,
  encrypt,
  decrypt,
  blindIndex,
  decryptRow,
};
