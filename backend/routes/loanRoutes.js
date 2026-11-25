const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/loanController');

router.get('/', ctrl.getAll);
router.get('/summary', ctrl.getSummary);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/:id/payment', ctrl.recordPayment);
router.put('/:id/cancel', ctrl.cancel);

module.exports = router;
