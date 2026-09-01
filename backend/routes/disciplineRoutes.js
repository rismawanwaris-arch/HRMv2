const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/disciplineController');

router.get('/stats', ctrl.getStats);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id/resolve', ctrl.resolve);
router.delete('/:id', ctrl.remove);

module.exports = router;
