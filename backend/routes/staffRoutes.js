const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/staffController');

router.get('/', ctrl.getAll);
router.get('/hired-candidates', ctrl.getHiredCandidates);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.put('/:id/status', ctrl.deactivate);
router.post('/promote/:candidateId', ctrl.promoteFromCandidate);

module.exports = router;
