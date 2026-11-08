'use strict';

const {
    listNotifications,
    unreadCount,
    markRead,
    markAllRead,
} = require('../services/notification.service');

const MAX_LIMIT = 50;
const NOTIFICATION_TYPES = new Set([
    'APPLICATION_SUBMITTED',
    'APPLICATION_STATUS_UPDATED',
    'DOCUMENT_UPLOADED',
    'DOCUMENT_VERIFIED',
    'GRIEVANCE_SUBMITTED',
    'GRIEVANCE_ASSIGNED',
    'GRIEVANCE_REASSIGNED',
    'GRIEVANCE_STATUS_UPDATED',
    'GRIEVANCE_ATTACHMENT_UPLOADED',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parsePagination(query) {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    const offset = query.offset === undefined ? 0 : Number(query.offset);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT
        || !Number.isInteger(offset) || offset < 0) return null;
    return { limit, offset };
}

async function getNotifications(req, res) {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ success: false, message: 'Invalid limit or offset.' });
    const unreadOnly = req.query.unread_only === undefined
        ? false
        : req.query.unread_only === 'true';
    if (req.query.unread_only !== undefined && !['true', 'false'].includes(req.query.unread_only)) {
        return res.status(400).json({ success: false, message: 'unread_only must be true or false.' });
    }
    if (req.query.type !== undefined && !NOTIFICATION_TYPES.has(req.query.type)) {
        return res.status(400).json({ success: false, message: 'Invalid notification type.' });
    }
    try {
        const notifications = await listNotifications(req.user, {
            ...pagination,
            unreadOnly,
            type: req.query.type,
        });
        return res.json({ success: true, notifications });
    } catch (error) {
        console.error('[notifications:list]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load notifications.' });
    }
}

async function getUnreadNotificationCount(req, res) {
    try {
        return res.json({ success: true, count: await unreadCount(req.user) });
    } catch (error) {
        console.error('[notifications:unreadCount]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load unread notifications.' });
    }
}

async function markNotificationAsRead(req, res) {
    if (!UUID_PATTERN.test(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Notification id must be a valid UUID.' });
    }
    try {
        const notification = await markRead(req.user, req.params.id);
        if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
        return res.json({ success: true, notification });
    } catch (error) {
        console.error('[notifications:markRead]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to mark notification as read.' });
    }
}

async function markAllNotificationsAsRead(req, res) {
    try {
        const count = await markAllRead(req.user);
        return res.json({ success: true, marked_count: count });
    } catch (error) {
        console.error('[notifications:markAllRead]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to mark notifications as read.' });
    }
}

module.exports = {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
};
