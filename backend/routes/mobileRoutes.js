const express = require('express');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
const { outletPhotoUpload } = require('../utils/helpers');

// 1. Master Data Cache (Read-only data for local SQLite)
router.get('/master-data', mobileController.getMasterData);

// 2. Offline-First Sync Endpoints (Idempotent by client_uuid)
router.post('/sync/asset', outletPhotoUpload.array('photos', 5), mobileController.syncAsset);
router.post('/sync/visit', outletPhotoUpload.array('photos', 5), mobileController.syncVisit);
router.post('/sync/incident', outletPhotoUpload.array('photos', 5), mobileController.syncIncident);
router.post('/sync/employee', mobileController.syncEmployee);

// 3. Online Browse & Search Endpoints
router.get('/assets', mobileController.getAssets);
router.get('/employees', mobileController.getEmployees);

module.exports = router;
