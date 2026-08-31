const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

const multer = require('multer');
const upload = multer({ dest: 'uploads/temp/' });

router.get('/', employeeController.getEmployees);
router.post('/manual', employeeController.addEmployeeManual);
router.post('/import', upload.single('file'), employeeController.importExcel);
router.put('/:id', employeeController.updateEmployee);

module.exports = router;
