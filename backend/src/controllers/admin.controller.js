'use strict';

/**
 * GramSetu – Admin Controller
 * Routes: GET /api/admin/stats, GET /api/admin/users, PATCH /api/admin/users/:id/status
 */

const pool = require('../config/db');

/** GET /api/admin/stats */
async function getStats(req, res) {
    try {
        const [usersRes, svcRes, appRes, grvRes, roleRes] = await Promise.all([
            pool.query('SELECT COUNT(*) AS total FROM users WHERE panchayat_id=$1', [req.user.panchayat_id]),
            pool.query('SELECT COUNT(*) AS total FROM services WHERE panchayat_id=$1 AND is_active=TRUE', [req.user.panchayat_id]),
            pool.query('SELECT COUNT(*) AS total FROM applications WHERE panchayat_id=$1', [req.user.panchayat_id]),
            pool.query("SELECT COUNT(*) AS total FROM grievances WHERE panchayat_id=$1 AND status='OPEN'", [req.user.panchayat_id]),
            pool.query(`SELECT r.name AS role, COUNT(u.id)::int AS count
                        FROM users u JOIN roles r ON r.id=u.role_id
                        WHERE u.panchayat_id=$1
                        GROUP BY r.name ORDER BY r.name`, [req.user.panchayat_id]),
        ]);
        return res.json({
            success: true,
            stats: {
                total_users:        parseInt(usersRes.rows[0].total),
                total_services:     parseInt(svcRes.rows[0].total),
                total_applications: parseInt(appRes.rows[0].total),
                open_grievances:    parseInt(grvRes.rows[0].total),
                users_by_role:      roleRes.rows,
            },
        });
    } catch (err) {
        console.error('[admin:getStats]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

/** GET /api/admin/users */
async function listUsers(req, res) {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await pool.query(
            `SELECT u.id, up.full_name, u.email, u.mobile, r.name AS role,
                    u.is_active, u.last_login_at, u.created_at
             FROM   users u
             JOIN   roles r ON r.id=u.role_id
             LEFT JOIN user_profiles up ON up.user_id=u.id
             WHERE  u.panchayat_id=$1
             ORDER  BY u.created_at DESC
             LIMIT  $2 OFFSET $3`,
            [req.user.panchayat_id, limit, offset]
        );
        return res.json({ success: true, users: result.rows, count: result.rowCount });
    } catch (err) {
        console.error('[admin:listUsers]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

/** PATCH /api/admin/users/:id/status */
async function setUserStatus(req, res) {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active (boolean) is required.' });
    }
    // Prevent admin from deactivating themselves
    if (id === req.user.id) {
        return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }
    try {
        const result = await pool.query(
            `UPDATE users SET is_active=$1, updated_at=NOW()
             WHERE id=$2 AND panchayat_id=$3
             RETURNING id, is_active`,
            [is_active, id, req.user.panchayat_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        return res.json({
            success: true,
            message: `User ${is_active ? 'activated' : 'deactivated'} successfully.`,
            user: result.rows[0],
        });
    } catch (err) {
        console.error('[admin:setUserStatus]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { getStats, listUsers, setUserStatus };
