const express = require('express');
const router = express.Router();
const controller = require('../controllers/outletActivityController');
const { outletPhotoUpload } = require('../utils/helpers');

// Daily Executive Summary & 1-Click WhatsApp Report
router.get('/summary', controller.getDailySummary);

// Store Visits & Inspection Log
router.get('/visits', controller.getVisits);
router.get('/visits/:id', controller.getVisitDetail);
router.post('/visits', outletPhotoUpload.array('photos', 5), controller.createVisit);
router.put('/visits/:id', outletPhotoUpload.array('photos', 5), controller.updateVisit);
router.delete('/visits/:id', controller.deleteVisit);

// Outlet Incidents / Unique Event Log per Cabang
router.get('/incidents', controller.getIncidents);
router.post('/incidents', outletPhotoUpload.array('photos', 5), controller.createIncident);
router.put('/incidents/:id', outletPhotoUpload.array('photos', 5), controller.updateIncident);
router.delete('/incidents/:id', controller.deleteIncident);

// Action Items / PR Follow-up
router.get('/action-items', controller.getActionItems);
router.post('/action-items', controller.createActionItem);
router.put('/action-items/:id', controller.updateActionItem);
router.delete('/action-items/:id', controller.deleteActionItem);

// Branch-Centric Comprehensive History & Profile
router.get('/branches/:id/history', controller.getBranchHistory);

// Stream Visit/Incident Photo securely
router.get('/photos/:filename', controller.servePhoto);

module.exports = router;
