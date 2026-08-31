const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');

router.get('/', ctrl.getByPeriod);
router.get('/summary', ctrl.summary);
router.put('/:employeeId/:period', ctrl.upsert);

module.exports = router;
