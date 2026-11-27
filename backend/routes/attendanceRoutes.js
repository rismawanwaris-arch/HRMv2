const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const { requireRole } = require('../middleware/roleCheck');

const FINANCE = ['finance', 'master'];

// Daily attendance input
router.get('/daily', ctrl.getByDate);
router.put('/daily/:employeeId/:date', ctrl.upsertDaily);

// Monthly summary and per-employee detail
router.get('/monthly', ctrl.getMonthlySummary);
router.get('/daily-detail/:employeeId', ctrl.getEmployeeDailyDetail);

// Cash advance / fake money update on attendance_records (affects payroll — finance/master only)
router.put('/record/:employeeId/:period', requireRole(...FINANCE), ctrl.upsertRecord);

// Sync daily → attendance_records (finance/master only)
router.post('/sync/:period', requireRole(...FINANCE), ctrl.syncPeriod);

// Branch-level ASBEN summary (used by payroll)
router.get('/summary', ctrl.summary);

module.exports = router;
