'use strict';

/**
 * GramSetu – Authentication Routes
 */

const { Router } = require('express');
const { registerCitizen, loginUser } = require('../controllers/auth.controller');

const router = Router();

// POST /api/auth/register — Citizen self-registration
router.post('/register', registerCitizen);

// POST /api/auth/login — All roles
router.post('/login', loginUser);

module.exports = router;
