const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payrollController');

router.get('/periods', ctrl.listPeriods);
router.post('/periods/:period/generate', ctrl.generateEntries);
router.get('/periods/:period/entries', ctrl.getEntries);
router.get('/periods/:period/summary', ctrl.getSummary);
router.put('/periods/:period/submit', ctrl.submitPeriod);
router.put('/entries/:id', ctrl.updateEntry);
router.get('/entries/:id/slip', ctrl.getSlip);

module.exports = router;
