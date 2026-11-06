'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { listGrievances, createGrievance, updateGrievanceStatus } = require('../controllers/grievances.controller');

const router = Router();
router.use(requireAuth);

router.get('/',              listGrievances);
router.post('/',             createGrievance);
router.patch('/:id/status', updateGrievanceStatus);

module.exports = router;
