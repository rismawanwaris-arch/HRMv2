const express = require('express');
const path = require('path');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { requireRole } = require('../middleware/roleCheck');

const upload = multer({
  dest: path.join(os.tmpdir(), 'hrmv2-imports'),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Format file tidak didukung. Gunakan .xlsx atau .xls'));
  }
});

router.get('/', branchController.getAllBranches);
router.get('/template', requireRole('finance', 'master'), branchController.downloadTemplate);
router.post('/import', requireRole('finance', 'master'), upload.single('file'), branchController.importBranches);
router.post('/', requireRole('finance', 'master'), branchController.createBranch);
router.delete('/:id', requireRole('finance', 'master'), branchController.deleteBranch);
router.put('/:id', requireRole('finance', 'master'), branchController.updateBranch);

module.exports = router;
