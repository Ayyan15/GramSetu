'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { listServices } = require('../controllers/services.controller');

const router = Router();

// GET /api/services — requires authentication (panchayat_id comes from token)
router.get('/', requireAuth, listServices);

module.exports = router;
