const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { query, uploadsDir } = require('../db');

async function getCandidateFolderName(candidateId) {
  try {
    const candidate = await query.get('SELECT name FROM candidates WHERE id = ?', [candidateId]);
    if (candidate && candidate.name) {
      const sanitizedName = candidate.name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
      return `${candidateId}_${sanitizedName}`;
    }
  } catch (e) {}
  return `candidate_${candidateId}`;
}

/**
 * Reduce an arbitrary string to a safe filename fragment (no path separators,
 * no traversal). Falls back to `doc` when nothing usable remains.
 * @param {any} value
 * @returns {string}
 */
function sanitizeFilenameFragment(value) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 40) || 'doc';
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const candidateId = parseInt(String(req.params.id), 10);
    if (!Number.isInteger(candidateId) || candidateId < 1) {
      return cb(new Error('ID kandidat tidak valid.'), '');
    }
    const tempFolder = path.join(uploadsDir, `candidate_${candidateId}`);
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
    }
    cb(null, tempFolder);
  },
  filename: function (req, file, cb) {
    const docType = sanitizeFilenameFragment(req.body.doc_type);
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const uniqueSuffix = Date.now() + '-' + crypto.randomInt(0, 1e9);
    cb(null, `${docType}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB Limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan .pdf, .jpg, .jpeg, atau .png'));
    }
  }
});

/**
 * Generate a random access code using a CSPRNG.
 * @param {string} [prefix] - Optional prefix (e.g. 'MAN-' for manual entries).
 * @returns {string}
 */
function generateAccessCode(prefix = '') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return prefix + code;
}

module.exports = {
  getCandidateFolderName,
  sanitizeFilenameFragment,
  upload,
  generateAccessCode
};
