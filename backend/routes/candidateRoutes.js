const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');

router.get('/', candidateController.getCandidates);
router.post('/', candidateController.addCandidate);
router.get('/:id', candidateController.getCandidateDetail);
router.put('/:id', candidateController.updateCandidate);
router.delete('/:id', candidateController.deleteCandidate);

router.get('/:id/documents', candidateController.getCandidateDocuments);
router.post('/:id/documents', candidateController.uploadDocument);
router.get('/:id/documents/:doc_id/file', candidateController.downloadDocument);
router.delete('/:id/documents/:doc_id', candidateController.deleteDocument);

router.put('/:id/stage/:stage_num', candidateController.updateCandidateStage);

module.exports = router;
