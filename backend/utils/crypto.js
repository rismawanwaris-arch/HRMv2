const crypto = require('crypto');

const SECRET = 'recruitment-secret-key-12345'; // HMAC signing key

/**
 * Hash a password using PBKDF2 with a random salt.
 * @param {string} password - The plain-text password.
 * @returns {string} The formatted salt and hash string.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored PBKDF2 hash.
 * @param {string} password - The plain-text password to check.
 * @param {string} storedPassword - The stored salt and hash string.
 * @returns {boolean} True if password matches, false otherwise.
 */
function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;
  const parts = storedPassword.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

/**
 * Generate a cryptographically signed HMAC token for admin session.
 * @param {string} username - Admin username.
 * @returns {string} The signed session token.
 */
function generateToken(username) {
  const payload = JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 });
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
    if (signature !== expectedSignature) return null;
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
  generateToken,
  verifyToken
};
