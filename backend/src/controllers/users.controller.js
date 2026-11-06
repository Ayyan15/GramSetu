'use strict';

/**
 * GramSetu – Users Controller
 * GET /api/users/me — returns the authenticated user's profile
 */

const pool = require('../config/db');

async function getMyProfile(req, res) {
    // req.user is set by requireAuth middleware: { id, role, panchayat_id }
    try {
        const result = await pool.query(
            `SELECT
                u.id,
                u.email,
                u.mobile,
                u.is_active,
                u.last_login_at,
                u.created_at,
                r.name       AS role,
                p.name       AS panchayat,
                p.id         AS panchayat_id,
                up.full_name,
                up.date_of_birth,
                up.gender,
                up.address_line,
                up.village   AS profile_village,
                up.profile_photo_url
             FROM   users u
             JOIN   roles      r  ON r.id      = u.role_id
             JOIN   panchayats p  ON p.id      = u.panchayat_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE  u.id = $1`,
            [req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const u = result.rows[0];
        return res.status(200).json({
            success: true,
            user: {
                id:           u.id,
                full_name:    u.full_name,
                email:        u.email,
                mobile:       u.mobile,
                role:         u.role,
                panchayat_id: u.panchayat_id,
                panchayat:    u.panchayat,
                gender:       u.gender,
                date_of_birth:u.date_of_birth,
                address_line: u.address_line,
                village:      u.profile_village,
                profile_photo_url: u.profile_photo_url,
                is_active:    u.is_active,
                last_login_at:u.last_login_at,
                created_at:   u.created_at,
            },
        });
    } catch (err) {
        console.error('[getMyProfile]', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { getMyProfile };
