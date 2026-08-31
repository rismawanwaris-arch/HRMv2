const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');

router.get('/', branchController.getAllBranches);
router.post('/', branchController.createBranch);
router.delete('/:id', branchController.deleteBranch);
router.put('/:id', branchController.updateBranch);

module.exports = router;
