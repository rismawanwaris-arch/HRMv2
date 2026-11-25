const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/claimsController');
const { requireRole } = require('../middleware/roleCheck');
const { outletPhotoUpload } = require('../utils/helpers');

const FINANCE = ['finance', 'master'];

// Overtime
router.get('/overtime', ctrl.getOvertime);
router.post('/overtime', ctrl.createOvertime);
router.put('/overtime/:id/approve', requireRole(...FINANCE), ctrl.approveOvertime);
router.put('/overtime/:id/reject', requireRole(...FINANCE), ctrl.rejectOvertime);
router.delete('/overtime/:id', requireRole(...FINANCE), ctrl.deleteOvertime);

// Reimbursements
router.get('/reimbursements', ctrl.getReimbursements);
router.post('/reimbursements', outletPhotoUpload.single('receipt'), ctrl.createReimbursement);
router.put('/reimbursements/:id/approve', requireRole(...FINANCE), ctrl.approveReimbursement);
router.put('/reimbursements/:id/reject', requireRole(...FINANCE), ctrl.rejectReimbursement);
router.delete('/reimbursements/:id', requireRole(...FINANCE), ctrl.deleteReimbursement);

// THR Calculator
router.get('/thr/preview', requireRole(...FINANCE), ctrl.previewTHR);
router.post('/thr/apply', requireRole(...FINANCE), ctrl.applyTHR);

module.exports = router;
