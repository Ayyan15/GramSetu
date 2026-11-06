'use strict';

/**
 * GramSetu – Applications Controller
 * GET /api/applications  — list (filtered by role)
 * PATCH /api/applications/:id/status — official review action
 */

const pool = require('../config/db');

/** GET /api/applications */
async function listApplications(req, res) {
    const { panchayat_id, id: userId, role } = req.user;
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    let whereExtra = '';
    const params = [panchayat_id, limit, offset];

    if (role === 'CITIZEN') {
        whereExtra = 'AND a.citizen_id = $4';
        params.push(userId);
    } else if (req.query.status) {
        whereExtra = 'AND a.status = $4';
        params.push(req.query.status);
    }

    try {
        const result = await pool.query(
            `SELECT a.id, a.status, a.priority, a.remarks, a.submitted_at, a.updated_at,
                    s.name AS service_name, s.name_marathi AS service_name_marathi,
                    up.full_name AS citizen_name, u.email AS citizen_email
             FROM   applications a
             JOIN   services       s  ON s.id  = a.service_id
             JOIN   users          u  ON u.id  = a.citizen_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE  a.panchayat_id = $1 ${whereExtra}
             ORDER  BY a.submitted_at DESC
             LIMIT  $2 OFFSET $3`,
            params
        );
        return res.json({ success: true, applications: result.rows, count: result.rowCount });
    } catch (err) {
        console.error('[applications:list]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

/** PATCH /api/applications/:id/status */
async function updateApplicationStatus(req, res) {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const allowedStatuses = ['PENDING','UNDER_REVIEW','APPROVED','REJECTED','CORRECTIONS_NEEDED'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }
    try {
        const result = await pool.query(
            `UPDATE applications
             SET    status      = $1,
                    remarks     = COALESCE($2, remarks),
                    reviewed_by = $3,
                    reviewed_at = NOW(),
                    updated_at  = NOW()
             WHERE  id = $4 AND panchayat_id = $5
             RETURNING id, status, remarks, updated_at`,
            [status, remarks || null, req.user.id, id, req.user.panchayat_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        // Audit log (non-blocking)
        pool.query(
            `INSERT INTO audit_logs (user_id, panchayat_id, action, entity_type, entity_id, new_values)
             VALUES ($1,$2,'APPLICATION_STATUS_UPDATED','application',$3,$4)`,
            [req.user.id, req.user.panchayat_id, id, JSON.stringify({ status, remarks })]
        ).catch(e => console.error('[audit]', e.message));
        return res.json({ success: true, message: `Application ${status.toLowerCase()}.`, application: result.rows[0] });
    } catch (err) {
        console.error('[applications:updateStatus]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { listApplications, updateApplicationStatus };
