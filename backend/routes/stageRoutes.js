const express = require('express');
const router = express.Router();
const stageController = require('../controllers/stageController');

router.get('/', stageController.getStages);
router.post('/', stageController.addStage);
router.put('/:id', stageController.updateStage);
router.delete('/:id', stageController.deleteStage);
router.post('/reorder', stageController.reorderStages);

module.exports = router;
