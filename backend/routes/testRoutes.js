const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

const { authenticateToken } = require('../middleware/auth');

router.get('/test/validate/:code', testController.validateTestAccess);
router.get('/test/questions/:code', testController.getTestQuestions);
router.post('/test/submit', testController.submitTest);

router.get('/admin/questions', authenticateToken, testController.getAdminQuestions);
router.post('/admin/questions', authenticateToken, testController.addAdminQuestion);
router.put('/admin/questions/:id', authenticateToken, testController.updateAdminQuestion);
router.delete('/admin/questions/:id', authenticateToken, testController.deleteAdminQuestion);

router.get('/admin/training-questions', authenticateToken, testController.getTrainingQuestions);
router.post('/admin/training-questions', authenticateToken, testController.addTrainingQuestion);
router.put('/admin/training-questions/:id', authenticateToken, testController.updateTrainingQuestion);
router.delete('/admin/training-questions/:id', authenticateToken, testController.deleteTrainingQuestion);

router.get('/training-test/validate/:code', testController.validateTrainingTest);
router.post('/training-test/submit', testController.submitTrainingTest);

module.exports = router;
