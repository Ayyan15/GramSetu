'use strict';

/**
 * GramSetu – Services Controller
 * Lists Panchayat services (certificates, utilities, etc.)
 */

const pool = require('../config/db');

/** GET /api/services — public list of active services for the panchayat */
async function listServices(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, name, name_marathi, description, category,
                    required_docs, processing_days, fee_amount, form_schema
             FROM   services
             WHERE  panchayat_id = $1 AND is_active = TRUE
             ORDER  BY category, name`,
            [req.user ? req.user.panchayat_id : 1]
        );
        return res.status(200).json({ success: true, services: result.rows });
    } catch (err) {
        console.error('[listServices]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { listServices };
