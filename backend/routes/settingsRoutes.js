const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settingsController');

router.get('/', ctrl.getSettings);
router.put('/', ctrl.updateSettings);
router.get('/penalty-rules', ctrl.getPenaltyRules);
router.post('/penalty-rules', ctrl.createPenaltyRule);
router.put('/penalty-rules/:id', ctrl.updatePenaltyRule);
router.delete('/penalty-rules/:id', ctrl.deletePenaltyRule);

module.exports = router;
