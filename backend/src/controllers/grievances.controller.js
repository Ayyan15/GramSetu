'use strict';

/**
 * GramSetu – Grievances Controller
 * GET  /api/grievances
 * POST /api/grievances
 * PATCH /api/grievances/:id/status
 */

const pool = require('../config/db');

/** GET /api/grievances */
async function listGrievances(req, res) {
    const { panchayat_id, id: userId, role } = req.user;
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    let whereExtra = '';
    const params = [panchayat_id, limit, offset];

    if (role === 'CITIZEN') {
        whereExtra = 'AND g.citizen_id = $4';
        params.push(userId);
    } else if (role === 'FIELD_WORKER' || req.query.assigned === 'me') {
        whereExtra = 'AND g.assigned_to = $4';
        params.push(userId);
    } else if (req.query.status) {
        whereExtra = 'AND g.status = $4';
        params.push(req.query.status);
    }

    try {
        const result = await pool.query(
            `SELECT g.id, g.title, g.description, g.category, g.status, g.priority,
                    g.location_text, g.latitude, g.longitude,
                    g.resolution_note, g.submitted_at, g.updated_at,
                    up.full_name AS citizen_name
             FROM   grievances g
             JOIN   users          u  ON u.id  = g.citizen_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE  g.panchayat_id = $1 ${whereExtra}
             ORDER  BY g.submitted_at DESC
             LIMIT  $2 OFFSET $3`,
            params
        );
        return res.json({ success: true, grievances: result.rows, count: result.rowCount });
    } catch (err) {
        console.error('[grievances:list]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

/** POST /api/grievances */
async function createGrievance(req, res) {
    const { title, description, category, location_text, latitude, longitude } = req.body;
    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }
    const validCategories = ['road','water','electricity','sanitation','other'];
    const cat = validCategories.includes(category) ? category : 'other';

    try {
        const result = await pool.query(
            `INSERT INTO grievances
                (panchayat_id, citizen_id, title, description, category, location_text, latitude, longitude)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING id, title, status, submitted_at`,
            [req.user.panchayat_id, req.user.id, title.trim(), description.trim(),
             cat, location_text || null,
             latitude  ? parseFloat(latitude)  : null,
             longitude ? parseFloat(longitude) : null]
        );
        return res.status(201).json({
            success: true,
            message: 'Grievance submitted successfully.',
            grievance: result.rows[0],
        });
    } catch (err) {
        console.error('[grievances:create]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

/** PATCH /api/grievances/:id/status */
async function updateGrievanceStatus(req, res) {
    const { id } = req.params;
    const { status, resolution_note } = req.body;
    const { role, id: userId, panchayat_id } = req.user;

    const allowedByRole = {
        PANCHAYAT_OFFICIAL: ['OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','REJECTED'],
        FIELD_WORKER:       ['IN_PROGRESS','RESOLVED'],
    };
    const allowed = allowedByRole[role] || [];
    if (!allowed.includes(status)) {
        return res.status(403).json({ success: false, message: `Role ${role} cannot set status to ${status}.` });
    }

    try {
        const result = await pool.query(
            `UPDATE grievances
             SET    status          = $1,
                    resolution_note = COALESCE($2, resolution_note),
                    resolved_at     = CASE WHEN $1 IN ('RESOLVED','CLOSED') THEN NOW() ELSE resolved_at END,
                    updated_at      = NOW()
             WHERE  id=$3 AND panchayat_id=$4
             RETURNING id, status, resolution_note, updated_at`,
            [status, resolution_note || null, id, panchayat_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Grievance not found.' });
        }
        return res.json({ success: true, message: `Grievance marked as ${status}.`, grievance: result.rows[0] });
    } catch (err) {
        console.error('[grievances:updateStatus]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { listGrievances, createGrievance, updateGrievanceStatus };
