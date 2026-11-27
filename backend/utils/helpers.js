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

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // fallback for some browsers/clients; verified by magic bytes
]);

const ALLOWED_EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
]);

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB Limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (allowedTypes.includes(ext) && ALLOWED_DOC_MIMES.has(mime)) {
      cb(null, true);
    } else {
      const err = new Error('Format file tidak didukung. Gunakan .pdf, .jpg, .jpeg, atau .png');
      err.status = 400;
      cb(err);
    }
  }
});

const tempUploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(uploadsDir, 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const field = sanitizeFilenameFragment(file.fieldname || 'doc');
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const uniqueSuffix = Date.now() + '-' + crypto.randomInt(0, 1e9);
    cb(null, `${field}-${uniqueSuffix}${ext}`);
  }
});

const candidateCreationUpload = multer({
  storage: tempUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (allowedTypes.includes(ext) && ALLOWED_DOC_MIMES.has(mime)) {
      cb(null, true);
    } else {
      const err = new Error(`Format file ${file.originalname} tidak didukung. Gunakan PDF, JPG, PNG, atau DOCX.`);
      err.status = 400;
      cb(err);
    }
  }
});

const excelUpload = multer({
  storage: tempUploadStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (allowedTypes.includes(ext) && ALLOWED_EXCEL_MIMES.has(mime)) {
      cb(null, true);
    } else {
      const err = new Error('Format file harus .xlsx, .xls, atau .csv');
      err.status = 400;
      cb(err);
    }
  }
});

const outletPhotosDir = path.join(uploadsDir, 'outlet_photos');
if (!fs.existsSync(outletPhotosDir)) {
  fs.mkdirSync(outletPhotosDir, { recursive: true });
}

const ALLOWED_PHOTO_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_PHOTO_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/octet-stream' // Flutter MultipartFile default when contentType is omitted
];

const outletPhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(outletPhotosDir)) {
      fs.mkdirSync(outletPhotosDir, { recursive: true });
    }
    cb(null, outletPhotosDir);
  },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_PHOTO_EXT.includes(rawExt) ? rawExt : '.jpg';
    const uniqueSuffix = Date.now() + '-' + crypto.randomInt(100000, 999999);
    cb(null, `visit_${uniqueSuffix}${safeExt}`);
  }
});

const outletPhotoUpload = multer({
  storage: outletPhotoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB Limit per photo
    files: 5
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_PHOTO_EXT.includes(ext) && ALLOWED_PHOTO_MIMES.includes(mime)) {
      cb(null, true);
    } else {
      const err = new Error('Format file foto tidak didukung. Gunakan file asli JPG, PNG, atau WEBP.');
      err.status = 400;
      cb(err);
    }
  }
});

/**
 * Safely remove uploaded files from disk (used when validation fails or on idempotent replay).
 * @param {Array<{path?: string}>} [files]
 */
function cleanupUploadedFiles(files) {
  if (!files || !Array.isArray(files)) return;
  for (const f of files) {
    if (f && f.path && fs.existsSync(f.path)) {
      try {
        fs.unlinkSync(f.path);
      } catch (e) {
        console.error('Failed to cleanup uploaded file:', e.message);
      }
    }
  }
}

/**
 * Inspect binary magic bytes of uploaded files to prevent MIME/extension spoofing.
 * Accepts genuine JPEG, PNG, and WEBP files.
 * @param {Array<{path: string}>} [files]
 * @returns {boolean} True if all files have valid image magic headers.
 */
function verifyImageMagicBytes(files) {
  if (!files || !Array.isArray(files) || files.length === 0) return true;
  for (const f of files) {
    if (!f || !f.path || !fs.existsSync(f.path)) return false;
    try {
      const fd = fs.openSync(f.path, 'r');
      const buf = Buffer.alloc(12);
      const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);
      if (bytesRead < 4) return false;

      // JPEG: FF D8 FF
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      const isPng =
        bytesRead >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a;
      // WEBP: "RIFF" (0..3) and "WEBP" (8..11)
      const isWebp =
        bytesRead >= 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP';

      if (!isJpeg && !isPng && !isWebp) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Express middleware enforcing magic-byte validation on uploaded image files.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function enforceImageMagicBytes(req, res, next) {
  const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
  if (files.length > 0 && !verifyImageMagicBytes(files)) {
    cleanupUploadedFiles(files);
    return res.status(400).json({
      success: false,
      message: 'File foto tidak valid atau terdeteksi bukan gambar asli (JPG/PNG/WEBP).'
    });
  }
  return next();
}

/**
 * Inspect binary magic bytes of uploaded document files (PDF, JPEG, PNG, DOC, DOCX).
 * Prevents spoofed HTML/scripts renamed to .pdf/.jpg/.docx from being stored.
 * @param {Array<{path: string, originalname?: string}>} [files]
 * @returns {boolean}
 */
function verifyDocumentMagicBytes(files) {
  if (!files || !Array.isArray(files) || files.length === 0) return true;
  for (const f of files) {
    if (!f || !f.path || !fs.existsSync(f.path)) return false;
    try {
      const fd = fs.openSync(f.path, 'r');
      const buf = Buffer.alloc(12);
      const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);
      if (bytesRead < 4) return false;

      const isPdf = buf.toString('ascii', 0, 4) === '%PDF';
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng =
        bytesRead >= 8 &&
        buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
        buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
      // DOCX (ZIP archive): 50 4B 03 04
      const isZip = buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && (buf[3] === 0x04 || buf[3] === 0x06);
      // Legacy DOC (OLE2 Compound Binary): D0 CF 11 E0 A1 B1 1A E1
      const isOle2 =
        bytesRead >= 8 &&
        buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
        buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1;

      if (!isPdf && !isJpeg && !isPng && !isZip && !isOle2) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Express middleware enforcing magic-byte validation on uploaded candidate document files.
 * Works with single (`req.file`), array (`req.files`), and fields (`req.files` object).
 */
function enforceDocumentMagicBytes(req, res, next) {
  let files = [];
  if (req.file) {
    files = [req.file];
  } else if (Array.isArray(req.files)) {
    files = req.files;
  } else if (req.files && typeof req.files === 'object') {
    files = Object.values(req.files).flat();
  }
  if (files.length > 0 && !verifyDocumentMagicBytes(files)) {
    cleanupUploadedFiles(files);
    return res.status(400).json({
      success: false,
      message: 'File dokumen tidak valid atau terdeteksi bukan file asli (PDF/JPG/PNG/DOC/DOCX).'
    });
  }
  return next();
}

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
  candidateCreationUpload,
  excelUpload,
  outletPhotoUpload,
  outletPhotosDir,
  cleanupUploadedFiles,
  verifyImageMagicBytes,
  enforceImageMagicBytes,
  verifyDocumentMagicBytes,
  enforceDocumentMagicBytes,
  generateAccessCode
};
