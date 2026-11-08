'use strict';

/**
 * GramSetu – Applications Controller
 * GET /api/applications  — list (filtered by role)
 * POST /api/applications — citizen service application submission
 * PATCH /api/applications/:id/status — official review action
 */

const pool = require('../config/db');
const { validateApplicationData } = require('../utils/application-schema');

/** POST /api/applications */
async function submitApplication(req, res) {
    const { service_id, application_data, remarks } = req.body || {};

    if (!Number.isInteger(service_id) || service_id <= 0) {
        return res.status(400).json({
            success: false,
            message: 'service_id must be a positive integer.',
        });
    }

    if (
        application_data === null
        || typeof application_data !== 'object'
        || Array.isArray(application_data)
    ) {
        return res.status(400).json({
            success: false,
            message: 'application_data must be a JSON object.',
        });
    }

    if (remarks !== undefined && typeof remarks !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'remarks must be a string.',
        });
    }

    const normalisedRemarks = remarks === undefined ? null : remarks.trim();
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const serviceResult = await client.query(
            `            SELECT id, name, name_marathi, category, required_docs,
                   processing_days, fee_amount, form_schema
             FROM   services
             WHERE  id = $1
               AND  panchayat_id = $2
               AND  is_active = TRUE`,
            [service_id, req.user.panchayat_id]
        );

        if (serviceResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Selected service was not found or is not available.',
            });
        }

        const validation = validateApplicationData(
            serviceResult.rows[0].form_schema,
            application_data
        );
        if (!validation.valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Application data is invalid.',
                errors: validation.errors,
            });
        }

        const applicationResult = await client.query(
            `INSERT INTO applications
                (panchayat_id, service_id, citizen_id, remarks, application_data)
             VALUES ($1, $2, $3, $4, $5::jsonb)
             RETURNING id, panchayat_id, service_id, citizen_id, status, priority,
                       remarks, application_data, submitted_at, updated_at`,
            [
                req.user.panchayat_id,
                service_id,
                req.user.id,
                normalisedRemarks || null,
                JSON.stringify(application_data),
            ]
        );

        const application = applicationResult.rows[0];
        await client.query(
            `INSERT INTO audit_logs
                (user_id, panchayat_id, action, entity_type, entity_id, new_values)
             VALUES ($1, $2, 'APPLICATION_SUBMITTED', 'application', $3, $4)`,
            [
                req.user.id,
                req.user.panchayat_id,
                application.id,
                JSON.stringify({
                    service_id,
                    event: 'APPLICATION_SUBMITTED',
                }),
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully.',
            application: {
                ...application,
                service: serviceResult.rows[0],
            },
        });
    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('[applications:submit] Rollback failed:', rollbackError.message);
            }
        }
        console.error('[applications:submit]', err.message);
        return res.status(500).json({
            success: false,
            message: 'Application submission failed. Please try again.',
        });
    } finally {
        if (client) client.release();
    }
}

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
    const transitions = {
        PENDING:       ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTIONS_NEEDED'],
        UNDER_REVIEW:  ['APPROVED', 'REJECTED', 'CORRECTIONS_NEEDED'],
        APPROVED:      [],
        REJECTED:      [],
        CORRECTIONS_NEEDED: [],
    };

    if (!Object.prototype.hasOwnProperty.call(transitions, status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${Object.keys(transitions).join(', ')}`,
        });
    }

    try {
        const currentResult = await pool.query(
            `SELECT id, status
             FROM   applications
             WHERE  id = $1 AND panchayat_id = $2`,
            [id, req.user.panchayat_id]
        );

        if (currentResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const currentStatus = currentResult.rows[0].status;
        if (!transitions[currentStatus] || !transitions[currentStatus].includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Application status cannot be changed from ${currentStatus} to ${status}.`,
            });
        }

        const result = await pool.query(
            `UPDATE applications
             SET    status      = $1,
                    remarks     = COALESCE($2, remarks),
                    reviewed_by = $3,
                    reviewed_at = NOW(),
                    updated_at  = NOW()
             WHERE  id = $4 AND panchayat_id = $5 AND status = $6
             RETURNING id, status, remarks, updated_at`,
            [status, remarks || null, req.user.id, id, req.user.panchayat_id, currentStatus]
        );
        if (result.rowCount === 0) {
            return res.status(409).json({
                success: false,
                message: 'Application status changed by another request. Please try again.',
            });
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

module.exports = { listApplications, submitApplication, updateApplicationStatus };
