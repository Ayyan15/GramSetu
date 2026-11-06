'use strict';

/**
 * GramSetu – User Routes
 * All routes require authentication.
 */

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { getMyProfile } = require('../controllers/users.controller');

const router = Router();

// All routes below require a valid JWT
router.use(requireAuth);

// GET /api/users/me — authenticated user's profile
router.get('/me', getMyProfile);

module.exports = router;
