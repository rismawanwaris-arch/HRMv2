const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { requireRole } = require('../middleware/roleCheck');
const { outletPhotoUpload, enforceImageMagicBytes } = require('../utils/helpers');

const FINANCE = ['finance', 'master'];

// Stats & Overview
router.get('/stats', assetController.getAssetStats);

// Logs
router.get('/logs/all', assetController.getAllAssetLogs);

// CRUD
router.get('/', assetController.getAssets);
router.get('/:id', assetController.getAssetDetail);
router.post('/', outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, assetController.createAsset);
router.put('/:id', outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, assetController.updateAsset);
router.delete('/:id', requireRole(...FINANCE), assetController.deleteAsset);

// Special Action Workflows
router.post('/:id/replace', outletPhotoUpload.array('photos', 5), enforceImageMagicBytes, assetController.replaceAsset);
router.post('/:id/mutate', assetController.mutateAsset);
router.post('/:id/service', assetController.serviceAsset);

module.exports = router;
