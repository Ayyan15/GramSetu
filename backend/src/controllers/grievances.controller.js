'use strict';

/**
 * GramSetu – Grievances Controller
 * GET   /api/grievances
 * POST  /api/grievances
 * GET   /api/grievances/workers
 * PATCH /api/grievances/:id/assign
 * PATCH /api/grievances/:id/status
 */

const pool = require('../config/db');
const {
    createNotifications,
    findRecipients,
    forRecipients,
} = require('../services/notification.service');

const VALID_CATEGORIES = ['road', 'water', 'electricity', 'sanitation', 'other'];
const VALID_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];
const VALID_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const MAX_LIMIT = 100;
const MAX_TITLE_LENGTH = 300;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_LOCATION_LENGTH = 1_000;

function isOfficial(role) {
    return role === 'PANCHAYAT_OFFICIAL' || role === 'SYSTEM_ADMIN';
}

function parsePagination(query) {
    const rawLimit = query.limit === undefined ? 20 : Number(query.limit);
    const rawOffset = query.offset === undefined ? 0 : Number(query.offset);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT
        || !Number.isInteger(rawOffset) || rawOffset < 0) {
        return null;
    }
    return { limit: rawLimit, offset: rawOffset };
}

function parseCoordinate(value, minimum, maximum, fieldName) {
    if (value === undefined || value === null || value === '') return { value: null };
    if (typeof value !== 'number' && typeof value !== 'string') {
        return { error: `${fieldName} must be a number.` };
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
        return { error: `${fieldName} must be between ${minimum} and ${maximum}.` };
    }
    return { value: parsed };
}

function addAuditValues(user, entityId, action, oldValues, newValues) {
    return [
        user.id,
        user.panchayat_id,
        action,
        'grievance',
        entityId,
        oldValues === null ? null : JSON.stringify(oldValues),
        newValues === null ? null : JSON.stringify(newValues),
    ];
}

async function insertAudit(client, user, entityId, action, oldValues, newValues) {
    await client.query(
        `INSERT INTO audit_logs
            (user_id, panchayat_id, action, entity_type, entity_id, old_values, new_values)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        addAuditValues(user, entityId, action, oldValues, newValues)
    );
}

function statusFilter(query, params, conditions) {
    if (query.status !== undefined) {
        if (!VALID_STATUSES.includes(query.status)) return false;
        params.push(query.status);
        conditions.push(`g.status = $${params.length}`);
    }
    return true;
}

function categoryFilter(query, params, conditions) {
    if (query.category !== undefined) {
        if (!VALID_CATEGORIES.includes(query.category)) return false;
        params.push(query.category);
        conditions.push(`g.category = $${params.length}`);
    }
    return true;
}

function priorityFilter(query, params, conditions) {
    if (query.priority !== undefined) {
        if (!VALID_PRIORITIES.includes(query.priority)) return false;
        params.push(query.priority);
        conditions.push(`g.priority = $${params.length}`);
    }
    return true;
}

/** GET /api/grievances */
async function listGrievances(req, res) {
    const { panchayat_id: panchayatId, id: userId, role } = req.user;
    const pagination = parsePagination(req.query);
    if (!pagination) {
        return res.status(400).json({ success: false, message: 'Invalid limit or offset.' });
    }

    const conditions = ['g.panchayat_id = $1'];
    const params = [panchayatId];

    if (role === 'CITIZEN') {
        params.push(userId);
        conditions.push(`g.citizen_id = $${params.length}`);
    } else if (role === 'FIELD_WORKER') {
        params.push(userId);
        conditions.push(`g.assigned_to = $${params.length}`);
    } else if (!isOfficial(role)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!statusFilter(req.query, params, conditions)
        || !categoryFilter(req.query, params, conditions)
        || !priorityFilter(req.query, params, conditions)) {
        return res.status(400).json({ success: false, message: 'Invalid grievance filter.' });
    }

    if (req.query.search !== undefined) {
        if (typeof req.query.search !== 'string' || req.query.search.trim().length === 0
            || req.query.search.length > 200) {
            return res.status(400).json({ success: false, message: 'Invalid search filter.' });
        }
        params.push(`%${req.query.search.trim()}%`);
        conditions.push(`(
            g.title ILIKE $${params.length}
            OR g.description ILIKE $${params.length}
            OR COALESCE(g.location_text, '') ILIKE $${params.length}
        )`);
    }

    params.push(pagination.limit);
    const limitPlaceholder = `$${params.length}`;
    params.push(pagination.offset);
    const offsetPlaceholder = `$${params.length}`;

    try {
        const result = await pool.query(
            `SELECT g.id, g.title, g.description, g.category, g.status, g.priority,
                    g.location_text, g.latitude, g.longitude, g.assigned_to,
                    g.resolution_note, g.submitted_at, g.updated_at, g.resolved_at,
                    up.full_name AS citizen_name
             FROM grievances g
             JOIN users u ON u.id = g.citizen_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE ${conditions.join(' AND ')}
             ORDER BY g.submitted_at DESC
             LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
            params
        );
        return res.json({ success: true, grievances: result.rows, count: result.rowCount });
    } catch (error) {
        console.error('[grievances:list]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load grievances.' });
    }
}

/** GET /api/grievances/workers */
async function listFieldWorkers(req, res) {
    if (!isOfficial(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    try {
        const result = await pool.query(
            `SELECT u.id, COALESCE(up.full_name, u.email, u.mobile) AS display_name
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE u.panchayat_id = $1
               AND u.is_active = TRUE
               AND r.name = 'FIELD_WORKER'
             ORDER BY display_name`,
            [req.user.panchayat_id]
        );
        return res.json({ success: true, workers: result.rows });
    } catch (error) {
        console.error('[grievances:listWorkers]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load field workers.' });
    }
}

/** POST /api/grievances */
async function createGrievance(req, res) {
    if (req.user.role !== 'CITIZEN') {
        return res.status(403).json({ success: false, message: 'Only citizens can submit grievances.' });
    }

    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = body.category;
    const locationText = body.location_text === undefined || body.location_text === null
        ? null
        : typeof body.location_text === 'string' ? body.location_text.trim() : undefined;
    const latitude = parseCoordinate(body.latitude, -90, 90, 'latitude');
    const longitude = parseCoordinate(body.longitude, -180, 180, 'longitude');

    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
        return res.status(400).json({ success: false, message: `Title is required and must be at most ${MAX_TITLE_LENGTH} characters.` });
    }
    if (description.length === 0 || description.length > MAX_DESCRIPTION_LENGTH) {
        return res.status(400).json({ success: false, message: `Description is required and must be at most ${MAX_DESCRIPTION_LENGTH} characters.` });
    }
    if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: 'A valid grievance category is required.' });
    }
    if (locationText === undefined || (locationText !== null && locationText.length > MAX_LOCATION_LENGTH)) {
        return res.status(400).json({ success: false, message: 'Location text is invalid.' });
    }
    if (latitude.error || longitude.error) {
        return res.status(400).json({ success: false, message: latitude.error || longitude.error });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const result = await client.query(
            `INSERT INTO grievances
                (panchayat_id, citizen_id, title, description, category,
                 location_text, latitude, longitude, status, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', 'NORMAL')
             RETURNING id, title, description, category, status, priority,
                       location_text, latitude, longitude, submitted_at, updated_at`,
            [
                req.user.panchayat_id,
                req.user.id,
                title,
                description,
                category,
                locationText,
                latitude.value,
                longitude.value,
            ]
        );
        const grievance = result.rows[0];
        const officials = await findRecipients(client, {
            panchayatId: req.user.panchayat_id,
            roles: ['PANCHAYAT_OFFICIAL', 'SYSTEM_ADMIN'],
        });
        await createNotifications(client, forRecipients(officials, {
            panchayatId: req.user.panchayat_id,
            actorId: req.user.id,
            notificationType: 'GRIEVANCE_SUBMITTED',
            title: 'New grievance submitted',
            message: `A new grievance was submitted: ${title}. नवीन तक्रार सादर झाली आहे.`,
            referenceType: 'grievance',
            referenceId: grievance.id,
            metadata: { category },
        }));
        await insertAudit(client, req.user, grievance.id, 'GRIEVANCE_CREATED', null, {
            status: grievance.status,
            priority: grievance.priority,
            category: grievance.category,
        });
        await client.query('COMMIT');
        return res.status(201).json({
            success: true,
            message: 'Grievance submitted successfully.',
            grievance,
        });
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('[grievances:create] Rollback failed:', rollbackError.message);
            }
        }
        console.error('[grievances:create]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to submit grievance.' });
    } finally {
        if (client) client.release();
    }
}

/** PATCH /api/grievances/:id/assign */
async function assignGrievance(req, res) {
    if (!isOfficial(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const assignedTo = req.body && req.body.assigned_to;
    if (typeof assignedTo !== 'string' || assignedTo.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'assigned_to is required.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const grievanceResult = await client.query(
            `SELECT id, status, assigned_to, citizen_id
             FROM grievances
             WHERE id = $1 AND panchayat_id = $2
             FOR UPDATE`,
            [req.params.id, req.user.panchayat_id]
        );
        if (grievanceResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Grievance not found.' });
        }
        const current = grievanceResult.rows[0];
        if (!['OPEN', 'ASSIGNED'].includes(current.status)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Only open or assigned grievances can be assigned.' });
        }

        const workerResult = await client.query(
            `SELECT u.id
             FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE u.id = $1
               AND u.panchayat_id = $2
               AND u.is_active = TRUE
               AND r.name = 'FIELD_WORKER'`,
            [assignedTo.trim(), req.user.panchayat_id]
        );
        if (workerResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'The selected field worker is invalid.' });
        }

        const updated = await client.query(
            `UPDATE grievances
             SET assigned_to = $1, status = 'ASSIGNED', updated_at = NOW()
             WHERE id = $2 AND panchayat_id = $3
               AND status IN ('OPEN', 'ASSIGNED')
             RETURNING id, status, assigned_to, updated_at`,
            [assignedTo.trim(), req.params.id, req.user.panchayat_id]
        );
        if (updated.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Grievance changed before assignment. Please try again.' });
        }

        const assignmentType = current.assigned_to ? 'GRIEVANCE_REASSIGNED' : 'GRIEVANCE_ASSIGNED';
        const assignmentMessage = current.assigned_to
            ? 'Your grievance has been reassigned to a new field worker. तुमची तक्रार नवीन क्षेत्रीय कर्मचाऱ्याला सोपवण्यात आली आहे.'
            : 'Your grievance has been assigned to a field worker. तुमची तक्रार क्षेत्रीय कर्मचाऱ्याला सोपवण्यात आली आहे.';
        const assignmentNotifications = [{
            panchayatId: req.user.panchayat_id,
            recipientId: current.citizen_id,
            actorId: req.user.id,
            notificationType: assignmentType,
            title: current.assigned_to ? 'Grievance reassigned' : 'Grievance assigned',
            message: assignmentMessage,
            referenceType: 'grievance',
            referenceId: req.params.id,
            metadata: { assigned_to: assignedTo.trim() },
        }, {
            panchayatId: req.user.panchayat_id,
            recipientId: assignedTo.trim(),
            actorId: req.user.id,
            notificationType: assignmentType,
            title: current.assigned_to ? 'Grievance reassigned to you' : 'Grievance assigned to you',
            message: 'A grievance has been assigned to you. तुम्हाला एक तक्रार सोपवण्यात आली आहे.',
            referenceType: 'grievance',
            referenceId: req.params.id,
            metadata: { assigned_to: assignedTo.trim() },
        }];
        if (current.assigned_to && current.assigned_to !== assignedTo.trim()) {
            assignmentNotifications.push({
                ...assignmentNotifications[1],
                recipientId: current.assigned_to,
                title: 'Grievance reassigned',
                message: 'This grievance has been reassigned to another field worker. ही तक्रार दुसऱ्या क्षेत्रीय कर्मचाऱ्याला सोपवण्यात आली आहे.',
            });
        }
        await createNotifications(client, assignmentNotifications);
        const action = current.assigned_to ? 'GRIEVANCE_REASSIGNED' : 'GRIEVANCE_ASSIGNED';
        await insertAudit(client, req.user, req.params.id, action, {
            status: current.status,
            assigned_to: current.assigned_to,
        }, {
            status: 'ASSIGNED',
            assigned_to: assignedTo.trim(),
        });
        await client.query('COMMIT');
        return res.json({ success: true, message: 'Grievance assigned successfully.', grievance: updated.rows[0] });
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('[grievances:assign] Rollback failed:', rollbackError.message);
            }
        }
        console.error('[grievances:assign]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to assign grievance.' });
    } finally {
        if (client) client.release();
    }
}

const TRANSITIONS = {
    PANCHAYAT_OFFICIAL: {
        OPEN: ['REJECTED'],
        RESOLVED: ['CLOSED', 'IN_PROGRESS'],
    },
    SYSTEM_ADMIN: {
        OPEN: ['REJECTED'],
        RESOLVED: ['CLOSED', 'IN_PROGRESS'],
    },
    FIELD_WORKER: {
        ASSIGNED: ['IN_PROGRESS'],
        IN_PROGRESS: ['RESOLVED'],
    },
};

function auditActionForStatus(previousStatus, status) {
    if (status === 'RESOLVED') return 'GRIEVANCE_RESOLVED';
    if (status === 'REJECTED') return 'GRIEVANCE_REJECTED';
    if (previousStatus === 'RESOLVED' && status === 'IN_PROGRESS') return 'GRIEVANCE_REOPENED';
    if (status === 'CLOSED') return 'GRIEVANCE_CLOSED';
    return 'GRIEVANCE_STATUS_CHANGED';
}

/** PATCH /api/grievances/:id/status */
async function updateGrievanceStatus(req, res) {
    const { status, resolution_note: resolutionNote } = req.body || {};
    const role = req.user.role;
    const transitions = TRANSITIONS[role];
    if (!transitions || !Object.values(VALID_STATUSES).includes(status)) {
        return res.status(403).json({ success: false, message: 'This role cannot update grievance status.' });
    }
    if (typeof resolutionNote !== 'undefined' && typeof resolutionNote !== 'string') {
        return res.status(400).json({ success: false, message: 'resolution_note must be a string.' });
    }
    const note = typeof resolutionNote === 'string' ? resolutionNote.trim() : '';
    if ((status === 'REJECTED' || status === 'IN_PROGRESS' && role !== 'FIELD_WORKER')
        && note.length === 0) {
        return res.status(400).json({ success: false, message: 'An explanation is required for this status change.' });
    }
    if (status === 'RESOLVED' && note.length === 0) {
        return res.status(400).json({ success: false, message: 'A resolution note is required.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const currentResult = await client.query(
            `SELECT id, status, assigned_to, citizen_id, resolution_note
             FROM grievances
             WHERE id = $1 AND panchayat_id = $2
             FOR UPDATE`,
            [req.params.id, req.user.panchayat_id]
        );
        if (currentResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Grievance not found.' });
        }
        const current = currentResult.rows[0];
        const allowedNext = transitions[current.status] || [];
        if (!allowedNext.includes(status)
            || (role === 'FIELD_WORKER' && current.assigned_to !== req.user.id)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'This grievance status transition is not permitted.' });
        }

        const updated = await client.query(
            `UPDATE grievances
             SET status = $1,
                 resolution_note = COALESCE($2, resolution_note),
                 resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW()
                                    WHEN $1 = 'IN_PROGRESS' AND status = 'RESOLVED' THEN NULL
                                    ELSE resolved_at END,
                 updated_at = NOW()
             WHERE id = $3 AND panchayat_id = $4
               AND status = $5
               AND ($6::boolean = FALSE OR assigned_to = $7)
             RETURNING id, status, assigned_to, resolution_note, resolved_at, updated_at`,
            [
                status,
                note || null,
                req.params.id,
                req.user.panchayat_id,
                current.status,
                role === 'FIELD_WORKER',
                req.user.id,
            ]
        );
        if (updated.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Grievance changed before update. Please try again.' });
        }

        const statusMessage = {
            IN_PROGRESS: 'Your grievance is now being worked on. तुमच्या तक्रारीवर काम सुरू झाले आहे.',
            RESOLVED: 'Your grievance has been resolved. तुमची तक्रार सोडवण्यात आली आहे.',
            CLOSED: 'Your grievance has been closed. तुमची तक्रार बंद करण्यात आली आहे.',
            REJECTED: 'Your grievance has been rejected. तुमची तक्रार नाकारण्यात आली आहे.',
        }[status] || `Your grievance status is now ${status.toLowerCase()}.`;
        const statusNotifications = [{
            panchayatId: req.user.panchayat_id,
            recipientId: current.citizen_id,
            actorId: req.user.id,
            notificationType: 'GRIEVANCE_STATUS_UPDATED',
            title: `Grievance ${status.toLowerCase().replace('_', ' ')}`,
            message: `${statusMessage}${note ? ` ${note}` : ''}`,
            referenceType: 'grievance',
            referenceId: req.params.id,
            metadata: { status },
        }];
        if (current.status === 'RESOLVED' && status === 'IN_PROGRESS' && current.assigned_to) {
            statusNotifications.push({
                ...statusNotifications[0],
                recipientId: current.assigned_to,
                title: 'Grievance reopened',
                message: 'A resolved grievance has been reopened and needs your attention. सोडवलेली तक्रार पुन्हा उघडण्यात आली आहे.',
            });
        }
        await createNotifications(client, statusNotifications);
        const action = auditActionForStatus(current.status, status);
        await insertAudit(client, req.user, req.params.id, action, {
            status: current.status,
            assigned_to: current.assigned_to,
            resolution_note: current.resolution_note,
        }, {
            status,
            assigned_to: updated.rows[0].assigned_to,
            resolution_note: updated.rows[0].resolution_note,
        });
        await client.query('COMMIT');
        return res.json({
            success: true,
            message: `Grievance marked as ${status}.`,
            grievance: updated.rows[0],
        });
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('[grievances:updateStatus] Rollback failed:', rollbackError.message);
            }
        }
        console.error('[grievances:updateStatus]', error.message);
        return res.status(500).json({ success: false, message: 'Unable to update grievance status.' });
    } finally {
        if (client) client.release();
    }
}

module.exports = {
    listGrievances,
    listFieldWorkers,
    createGrievance,
    assignGrievance,
    updateGrievanceStatus,
};
