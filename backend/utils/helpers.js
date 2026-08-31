const multer = require('multer');
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const candidateId = req.params.id;
    const tempFolder = path.join(uploadsDir, `candidate_${candidateId}`);
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
    }
    cb(null, tempFolder);
  },
  filename: function (req, file, cb) {
    const docType = req.body.doc_type || 'doc';
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
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

function generateAccessCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
  getCandidateFolderName,
  upload,
  generateAccessCode
};
