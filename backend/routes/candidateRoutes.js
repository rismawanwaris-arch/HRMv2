const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const { candidateCreationUpload, excelUpload } = require('../utils/helpers');

router.get('/', candidateController.getCandidates);
router.post('/', candidateController.addCandidate);

// Dedicated applicant upload & bulk excel routes (ZimaOS storage)
router.get('/template-excel', candidateController.downloadCandidateTemplateExcel);
router.post('/import-excel', excelUpload.single('file'), candidateController.importCandidatesExcel);
router.post('/parse-cv', candidateCreationUpload.single('cv'), candidateController.parseCv);
router.post('/parse-cv-file', candidateCreationUpload.single('file'), candidateController.parseCv);
router.post(
  '/upload-with-docs',
  candidateCreationUpload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'foto', maxCount: 1 },
    { name: 'ijazah', maxCount: 1 },
    { name: 'surat_lamaran', maxCount: 1 },
    { name: 'skck', maxCount: 1 },
    { name: 'other', maxCount: 5 }
  ]),
  candidateController.addCandidateWithDocuments
);

router.get('/:id', candidateController.getCandidateDetail);
router.put('/:id', candidateController.updateCandidate);
router.delete('/:id', candidateController.deleteCandidate);

router.get('/:id/documents', candidateController.getCandidateDocuments);
router.post('/:id/documents', candidateController.uploadDocument);
router.get('/:id/documents/:doc_id/file', candidateController.downloadDocument);
router.delete('/:id/documents/:doc_id', candidateController.deleteDocument);

router.put('/:id/stage/:stage_num', candidateController.updateCandidateStage);

module.exports = router;
