const express = require('express');
const path = require('path');
const os = require('os');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

const multer = require('multer');
const ALLOWED_IMPORT_EXT = ['.xlsx', '.xls', '.csv'];
const upload = multer({
  dest: path.join(os.tmpdir(), 'hrmv2-imports'),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMPORT_EXT.includes(ext)) cb(null, true);
    else cb(new Error('Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv'));
  }
});

router.get('/template', employeeController.downloadTemplate);
router.get('/', employeeController.getEmployees);
router.post('/manual', employeeController.addEmployeeManual);
router.post('/import', upload.single('file'), employeeController.importExcel);
router.put('/:id', employeeController.updateEmployee);

module.exports = router;
