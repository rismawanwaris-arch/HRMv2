const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financialController');

router.get('/outlet', ctrl.getOutletReport);
router.put('/outlet/:branchId/:period', ctrl.upsertOutlet);
router.get('/warehouse', ctrl.getWarehouseReport);
router.put('/warehouse/:branchId/:period', ctrl.upsertWarehouse);
router.get('/consolidation', ctrl.getConsolidatedReport);

module.exports = router;
