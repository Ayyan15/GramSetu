'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} = require('../controllers/notifications.controller');

const router = Router();
router.use(requireAuth);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/:id/read', markNotificationAsRead);
router.patch('/read-all', markAllNotificationsAsRead);

module.exports = router;
