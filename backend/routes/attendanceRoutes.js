const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');

// Daily attendance input
router.get('/daily', ctrl.getByDate);
router.put('/daily/:employeeId/:date', ctrl.upsertDaily);

// Monthly summary and per-employee detail
router.get('/monthly', ctrl.getMonthlySummary);
router.get('/daily-detail/:employeeId', ctrl.getEmployeeDailyDetail);

// Cash advance / fake money update on attendance_records
router.put('/record/:employeeId/:period', ctrl.upsertRecord);

// Sync daily → attendance_records
router.post('/sync/:period', ctrl.syncPeriod);

// Branch-level ASBEN summary (used by payroll)
router.get('/summary', ctrl.summary);

module.exports = router;
