const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leaveController');
const { requireRole } = require('../middleware/roleCheck');

const FINANCE = ['finance', 'master'];

router.get('/types', ctrl.getTypes);
router.post('/types', requireRole(...FINANCE), ctrl.createType);
router.put('/types/:id', requireRole(...FINANCE), ctrl.updateType);

router.get('/balances', ctrl.getBalances);
router.post('/balances/init-year', requireRole(...FINANCE), ctrl.initYearBalances);
router.put('/balances/:id', requireRole(...FINANCE), ctrl.updateBalance);

router.get('/requests', ctrl.getRequests);
router.post('/requests', ctrl.createRequest);
router.put('/requests/:id/approve', requireRole(...FINANCE), ctrl.approveRequest);
router.put('/requests/:id/reject', requireRole(...FINANCE), ctrl.rejectRequest);
router.put('/requests/:id/cancel', ctrl.cancelRequest);

module.exports = router;
