'use strict';

/**
 * GramSetu – Authentication Controller
 *
 * Milestone 2.3: Citizen Registration ONLY.
 * Login / JWT / privileged account creation are NOT implemented here.
 */

const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
const { validateFullName, validateEmail, validateMobile, validatePassword } = require('../utils/validators');

// Fixed constants — never read from request body
const BCRYPT_ROUNDS   = 12;
const CITIZEN_ROLE    = 'CITIZEN';
const PANCHAYAT_QUERY = "SELECT id FROM panchayats WHERE is_active = TRUE LIMIT 1";
const ROLE_QUERY      = "SELECT id FROM roles WHERE name = $1 LIMIT 1";

// ─── POST /api/auth/register ──────────────────────────────────────────────────

/**
 * Citizen self-registration.
 *
 * Security rules enforced server-side regardless of request body:
 *   - Role is ALWAYS set to CITIZEN.
 *   - Panchayat is ALWAYS the active Kini Gram Panchayat.
 *   - Password is bcrypt-hashed before storage.
 *   - password_hash is NEVER returned in any response.
 *   - SQL uses parameterised queries throughout.
 */
async function registerCitizen(req, res) {
    // ── 1. Extract and validate inputs ────────────────────────────────────────
    const {
        full_name,
        email,
        mobile,
        password,
        confirm_password,
    } = req.body;

    // Validate full name
    const nameCheck = validateFullName(full_name);
    if (!nameCheck.valid) {
        return res.status(400).json({ success: false, message: nameCheck.message });
    }

    // At least one contact method is required
    const hasEmail  = email  && String(email).trim().length > 0;
    const hasMobile = mobile && String(mobile).trim().length > 0;
    if (!hasEmail && !hasMobile) {
        return res.status(400).json({
            success: false,
            message: 'Please provide an email address or mobile number.',
        });
    }

    // Validate email if provided
    let normalisedEmail = null;
    if (hasEmail) {
        const emailCheck = validateEmail(email);
        if (!emailCheck.valid) {
            return res.status(400).json({ success: false, message: emailCheck.message });
        }
        normalisedEmail = String(email).trim().toLowerCase();
    }

    // Validate mobile if provided
    let normalisedMobile = null;
    if (hasMobile) {
        const mobileCheck = validateMobile(mobile);
        if (!mobileCheck.valid) {
            return res.status(400).json({ success: false, message: mobileCheck.message });
        }
        normalisedMobile = mobileCheck.normalised;
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ success: false, message: passwordCheck.message });
    }

    // Confirm password match (if supplied)
    if (confirm_password !== undefined && confirm_password !== password) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // ── 2. Resolve panchayat and role IDs (never from request) ───────────────
    let panchayatId, citizenRoleId;
    try {
        const [panchayatRes, roleRes] = await Promise.all([
            pool.query(PANCHAYAT_QUERY),
            pool.query(ROLE_QUERY, [CITIZEN_ROLE]),
        ]);

        if (panchayatRes.rowCount === 0) {
            console.error('[register] No active panchayat found — run db:seed first.');
            return res.status(503).json({
                success: false,
                message: 'Service temporarily unavailable. Please try again later.',
            });
        }
        if (roleRes.rowCount === 0) {
            console.error('[register] CITIZEN role not found — run db:seed first.');
            return res.status(503).json({
                success: false,
                message: 'Service temporarily unavailable. Please try again later.',
            });
        }

        panchayatId    = panchayatRes.rows[0].id;
        citizenRoleId  = roleRes.rows[0].id;
    } catch (err) {
        console.error('[register] Failed to resolve panchayat/role:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    // ── 3. Check for duplicate email / mobile ─────────────────────────────────
    try {
        if (normalisedEmail) {
            const emailExists = await pool.query(
                'SELECT id FROM users WHERE email = $1 LIMIT 1',
                [normalisedEmail]
            );
            if (emailExists.rowCount > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'An account with this email address already exists.',
                });
            }
        }

        if (normalisedMobile) {
            const mobileExists = await pool.query(
                'SELECT id FROM users WHERE mobile = $1 LIMIT 1',
                [normalisedMobile]
            );
            if (mobileExists.rowCount > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'An account with this mobile number already exists.',
                });
            }
        }
    } catch (err) {
        console.error('[register] Duplicate check failed:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    // ── 4. Hash password ──────────────────────────────────────────────────────
    let passwordHash;
    try {
        passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    } catch (err) {
        console.error('[register] bcrypt error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    // ── 5. Insert user + profile in a single transaction ─────────────────────
    const client = await pool.connect();
    let newUserId;
    try {
        await client.query('BEGIN');

        // Insert into users
        const userInsert = await client.query(
            `INSERT INTO users
                (panchayat_id, role_id, email, mobile, password_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, mobile, created_at`,
            [panchayatId, citizenRoleId, normalisedEmail, normalisedMobile, passwordHash]
        );
        const newUser = userInsert.rows[0];
        newUserId = newUser.id;

        // Insert into user_profiles
        await client.query(
            `INSERT INTO user_profiles (user_id, full_name)
             VALUES ($1, $2)`,
            [newUserId, String(full_name).trim()]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_logs
                (user_id, panchayat_id, action, entity_type, entity_id, new_values)
             VALUES ($1, $2, 'CITIZEN_REGISTERED', 'user', $3, $4)`,
            [
                newUserId,
                panchayatId,
                newUserId,
                JSON.stringify({
                    email:      normalisedEmail,
                    mobile:     normalisedMobile,
                    full_name:  String(full_name).trim(),
                    role:       CITIZEN_ROLE,
                }),
            ]
        );

        await client.query('COMMIT');

        // ── 6. Respond — NEVER include password_hash ─────────────────────────
        return res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to Kini Gram Panchayat services.',
            user: {
                id:          newUserId,
                full_name:   String(full_name).trim(),
                email:       newUser.email,
                mobile:      newUser.mobile,
                role:        CITIZEN_ROLE,
                panchayat:   'Kini Gram Panchayat',
                created_at:  newUser.created_at,
            },
        });

    } catch (err) {
        await client.query('ROLLBACK');

        // Handle unique constraint violation (race condition after duplicate check)
        if (err.code === '23505') {
            const field = err.constraint && err.constraint.includes('email') ? 'email address' : 'mobile number';
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists.`,
            });
        }

        console.error('[register] Transaction failed:', err.message);
        return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });

    } finally {
        client.release();
    }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES     = 15;

/**
 * Login for all roles.
 * Accepts email OR mobile + password.
 * Returns signed JWT access token and basic user info (never password_hash).
 */
async function loginUser(req, res) {
    const { identifier, password } = req.body;

    // ── 1. Validate inputs ────────────────────────────────────────────────────
    if (!identifier || !String(identifier).trim()) {
        return res.status(400).json({
            success: false,
            message: 'Please provide your email address or mobile number.',
        });
    }
    if (!password || !String(password).trim()) {
        return res.status(400).json({ success: false, message: 'Please provide your password.' });
    }

    const id = String(identifier).trim().toLowerCase();

    // ── 2. Look up user by email OR mobile with role and panchayat joined ─────
    let user;
    try {
        const result = await pool.query(
            `SELECT
                u.id,
                u.email,
                u.mobile,
                u.password_hash,
                u.is_active,
                u.failed_login_attempts,
                u.locked_until,
                u.panchayat_id,
                r.name  AS role,
                p.name  AS panchayat_name,
                up.full_name
             FROM   users        u
             JOIN   roles        r  ON r.id  = u.role_id
             JOIN   panchayats   p  ON p.id  = u.panchayat_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE  (LOWER(u.email) = $1 OR u.mobile = $1)
             LIMIT  1`,
            [id]
        );

        if (result.rowCount === 0) {
            // Generic message — do not reveal whether email/mobile exists
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. Please check your email/mobile and password.',
            });
        }

        user = result.rows[0];
    } catch (err) {
        console.error('[login] DB lookup failed:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    // ── 3. Account active check ───────────────────────────────────────────────
    if (!user.is_active) {
        return res.status(403).json({
            success: false,
            message: 'Your account has been deactivated. Please contact the Panchayat office.',
        });
    }

    // ── 4. Account lockout check ──────────────────────────────────────────────
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
        return res.status(423).json({
            success: false,
            message: `Account temporarily locked due to too many failed attempts. Try again in ${remaining} minute(s).`,
        });
    }

    // ── 5. Verify password ────────────────────────────────────────────────────
    let passwordMatch;
    try {
        passwordMatch = await bcrypt.compare(password, user.password_hash);
    } catch (err) {
        console.error('[login] bcrypt error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    if (!passwordMatch) {
        // Increment failed attempts; lock after MAX_FAILED_ATTEMPTS
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        const lockUntil   = newAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null;

        await pool.query(
            `UPDATE users
             SET    failed_login_attempts = $1,
                    locked_until          = $2,
                    updated_at            = NOW()
             WHERE  id = $3`,
            [newAttempts, lockUntil, user.id]
        ).catch(e => console.error('[login] Failed to update attempt counter:', e.message));

        const attemptsLeft = MAX_FAILED_ATTEMPTS - newAttempts;
        const message = lockUntil
            ? `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed login attempts.`
            : `Invalid credentials. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining before lockout.` : ''}`;

        return res.status(401).json({ success: false, message });
    }

    // ── 6. Successful login — reset counters + issue JWT ─────────────────────
    await pool.query(
        `UPDATE users
         SET    failed_login_attempts = 0,
                locked_until          = NULL,
                last_login_at         = NOW(),
                updated_at            = NOW()
         WHERE  id = $1`,
        [user.id]
    ).catch(e => console.error('[login] Failed to reset counters:', e.message));

    // Audit log
    pool.query(
        `INSERT INTO audit_logs (user_id, panchayat_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, $2, 'USER_LOGIN', 'user', $3, $4::inet)`,
        [user.id, user.panchayat_id, user.id, req.ip || null]
    ).catch(e => console.error('[login] Audit log error:', e.message));

    // Sign JWT — sub = user UUID, role and panchayat_id in payload
    const tokenPayload = {
        sub:          user.id,
        role:         user.role,
        panchayat_id: user.panchayat_id,
    };
    const accessToken = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // ── 7. Respond — NEVER include password_hash ──────────────────────────────
    return res.status(200).json({
        success: true,
        message: 'Login successful. Welcome to GramSetu.',
        token: accessToken,
        user: {
            id:           user.id,
            full_name:    user.full_name   || null,
            email:        user.email       || null,
            mobile:       user.mobile      || null,
            role:         user.role,
            panchayat_id: user.panchayat_id,
            panchayat:    user.panchayat_name,
        },
    });
}

module.exports = { registerCitizen, loginUser };
