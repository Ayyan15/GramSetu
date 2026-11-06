'use strict';

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { getStats, listUsers, setUserStatus } = require('../controllers/admin.controller');

const router = Router();
router.use(requireAuth);
router.use(requireRole('SYSTEM_ADMIN'));

router.get('/stats',               getStats);
router.get('/users',               listUsers);
router.patch('/users/:id/status',  setUserStatus);

module.exports = router;
