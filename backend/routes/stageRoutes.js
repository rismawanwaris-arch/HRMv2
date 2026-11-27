const express = require('express');
const router = express.Router();
const stageController = require('../controllers/stageController');
const { requireRole } = require('../middleware/roleCheck');

router.get('/', stageController.getStages);
router.post('/', stageController.addStage);
router.put('/:id', stageController.updateStage);
router.delete('/:id', requireRole('master'), stageController.deleteStage);
router.post('/reorder', stageController.reorderStages);

module.exports = router;
