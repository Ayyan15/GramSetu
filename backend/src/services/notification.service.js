'use strict';

const pool = require('../config/db');

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

function assertNotification(notification) {
    if (!NOTIFICATION_TYPES.has(notification.notificationType)
        || typeof notification.title !== 'string'
        || typeof notification.message !== 'string'
        || !Number.isInteger(notification.panchayatId)
        || notification.panchayatId <= 0
        || typeof notification.recipientId !== 'string'
        || !UUID_PATTERN.test(notification.recipientId)) {
        throw new Error('Invalid notification data.');
    }
    if (notification.actorId !== undefined
        && notification.actorId !== null
        && (typeof notification.actorId !== 'string' || !UUID_PATTERN.test(notification.actorId))) {
        throw new Error('Invalid notification actor.');
    }
}

async function createNotification(client, notification) {
    assertNotification(notification);
    const recipientResult = await client.query(
        `SELECT id
         FROM users u
         WHERE u.id = $2
           AND u.panchayat_id = $1
           AND u.is_active = TRUE`,
        [notification.panchayatId, notification.recipientId]
    );
    if (recipientResult.rowCount === 0) {
        const error = new Error('Notification recipient is missing, inactive, or outside the Panchayat.');
        error.code = 'NOTIFICATION_RECIPIENT_INVALID';
        throw error;
    }

    const result = await client.query(
        `INSERT INTO notifications
            (panchayat_id, recipient_id, actor_id, notification_type,
             title, message, reference_type, reference_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id, recipient_id, notification_type, title, message,
                   reference_type, reference_id, metadata, is_read, read_at, created_at`,
        [
            notification.panchayatId,
            notification.recipientId,
            notification.actorId || null,
            notification.notificationType,
            notification.title,
            notification.message,
            notification.referenceType || null,
            notification.referenceId || null,
            JSON.stringify(notification.metadata || {}),
        ]
    );
    return result.rows[0] || null;
}

async function createNotifications(client, notifications) {
    if (!Array.isArray(notifications)) throw new Error('Notifications must be an array.');
    const created = [];
    for (const notification of notifications) {
        const result = await createNotification(client, notification);
        if (!result) throw new Error('Notification could not be created.');
        created.push(result);
    }
    return created;
}

async function findRecipients(client, { panchayatId, roles }) {
    const result = await client.query(
        `SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.panchayat_id = $1
           AND u.is_active = TRUE
           AND r.name = ANY($2::text[])`,
        [panchayatId, roles]
    );
    return result.rows.map(row => row.id);
}

function forRecipients(recipientIds, data) {
    return recipientIds.map(recipientId => ({ ...data, recipientId }));
}

async function listNotifications(user, { limit, offset, unreadOnly, type }) {
    const params = [user.panchayat_id, user.id, limit, offset];
    const conditions = ['panchayat_id = $1', 'recipient_id = $2'];
    if (unreadOnly) conditions.push('is_read = FALSE');
    if (type) {
        params.push(type);
        conditions.push(`notification_type = $${params.length}`);
    }
    const result = await pool.query(
        `SELECT id, notification_type, title, message, reference_type,
                reference_id, metadata, is_read, read_at, created_at
         FROM notifications
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        params
    );
    return result.rows;
}

async function unreadCount(user) {
    const result = await pool.query(
        `SELECT COUNT(*)::integer AS count
         FROM notifications
         WHERE panchayat_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
        [user.panchayat_id, user.id]
    );
    return result.rows[0].count;
}

async function markRead(user, notificationId) {
    const result = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = COALESCE(read_at, NOW())
         WHERE id = $1 AND panchayat_id = $2 AND recipient_id = $3
         RETURNING id, is_read, read_at`,
        [notificationId, user.panchayat_id, user.id]
    );
    return result.rows[0] || null;
}

async function markAllRead(user) {
    const result = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE panchayat_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
        [user.panchayat_id, user.id]
    );
    return result.rowCount;
}

module.exports = {
    createNotification,
    createNotifications,
    findRecipients,
    forRecipients,
    listNotifications,
    unreadCount,
    markRead,
    markAllRead,
};
