'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { listApplications, updateApplicationStatus } = require('../controllers/applications.controller');

const router = Router();
router.use(requireAuth);

router.get('/',              listApplications);
router.patch('/:id/status', updateApplicationStatus);

module.exports = router;
