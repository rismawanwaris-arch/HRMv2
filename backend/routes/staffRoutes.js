const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/staffController');

router.get('/', ctrl.getAll);
router.get('/hired-candidates', ctrl.getHiredCandidates);
router.get('/contract-alerts', ctrl.getContractAlerts);
router.get('/:id', ctrl.getById);
router.get('/:id/history', ctrl.getHistory);
router.post('/:id/history', ctrl.addHistory);
router.post('/:id/renew-contract', ctrl.renewContract);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.put('/:id/status', ctrl.deactivate);
router.post('/promote/:candidateId', ctrl.promoteFromCandidate);

module.exports = router;
