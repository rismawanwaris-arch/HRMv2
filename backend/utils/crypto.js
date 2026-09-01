const crypto = require('crypto');

/**
 * HMAC signing key for session tokens. Must be provided via the JWT_SECRET
 * environment variable. In production a missing secret is fatal; in
 * development we fall back to a fixed dev-only value with a loud warning so
 * local setup still works.
 */
const SECRET = (() => {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required (min 16 chars) in production.');
  }
  console.warn('[crypto] JWT_SECRET not set — using an insecure development-only key. Do NOT use in production.');
  return 'dev-only-insecure-secret-change-me';
})();

// PBKDF2 work factor. OWASP recommends >= 210k iterations for PBKDF2-HMAC-SHA512.
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

/**
 * Constant-time string comparison for hex-encoded values.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash a password using PBKDF2 with a random salt.
 * Format: `salt:iterations:hash` (all hex except iterations).
 * @param {string} password - The plain-text password.
 * @returns {string} The formatted salt/iterations/hash string.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `${salt}:${PBKDF2_ITERATIONS}:${hash}`;
}

/**
 * Verify a plain-text password against a stored PBKDF2 hash.
 * Accepts both the current `salt:iterations:hash` format and the legacy
 * `salt:hash` format (which used 1000 iterations).
 * @param {string} password - The plain-text password to check.
 * @param {string} storedPassword - The stored hash string.
 * @returns {boolean} True if the password matches, false otherwise.
 */
function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;
  const parts = storedPassword.split(':');

  let salt;
  let iterations;
  let originalHash;
  if (parts.length === 3) {
    [salt, , originalHash] = parts;
    iterations = parseInt(parts[1], 10);
  } else if (parts.length === 2) {
    [salt, originalHash] = parts;
    iterations = 1000; // legacy default
  } else {
    return false;
  }

  if (!salt || !originalHash || !Number.isInteger(iterations) || iterations < 1) return false;

  const hash = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return safeEqualHex(hash, originalHash);
}

/**
 * True when a stored hash uses an outdated format/work factor and should be
 * re-hashed on the next successful login.
 * @param {string} storedPassword
 * @returns {boolean}
 */
function needsRehash(storedPassword) {
  if (!storedPassword) return true;
  const parts = storedPassword.split(':');
  if (parts.length !== 3) return true;
  return parseInt(parts[1], 10) < PBKDF2_ITERATIONS;
}

/**
 * Generate a cryptographically signed HMAC token for an admin session.
 * @param {string} username - Admin username.
 * @returns {string} The signed session token.
 */
function generateToken(username, extra = {}) {
  const payload = JSON.stringify({ username, ...extra, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + signature;
}

/**
 * Verify and parse a signed HMAC token.
 * @param {string} token - The signed token string.
 * @returns {Object|null} The parsed payload if valid and not expired, null otherwise.
 */
function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = Buffer.from(parts[0], 'base64').toString('utf8');
    const signature = parts[1];
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    if (!safeEqualHex(signature, expectedSignature)) return null;
    const parsed = JSON.parse(payload);
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateToken,
  verifyToken
};
