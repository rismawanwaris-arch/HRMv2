const express = require('express');
const path = require('path');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const branchController = require('../controllers/branchController');

const upload = multer({
  dest: path.join(os.tmpdir(), 'hrmv2-imports'),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Format file tidak didukung. Gunakan .xlsx atau .xls'));
  }
});

router.get('/template', branchController.downloadTemplate);
router.post('/import', upload.single('file'), branchController.importBranches);
router.get('/', branchController.getAllBranches);
router.post('/', branchController.createBranch);
router.delete('/:id', branchController.deleteBranch);
router.put('/:id', branchController.updateBranch);

module.exports = router;
