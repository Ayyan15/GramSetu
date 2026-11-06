'use strict';

/**
 * GramSetu – JWT Authentication Middleware
 *
 * Verifies the Bearer token and attaches req.user = { id, role, panchayat_id }
 * Also provides requireRole(...roles) for authorization checks.
 */

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id:           payload.sub,
            role:         payload.role,
            panchayat_id: payload.panchayat_id,
        };
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError'
            ? 'Session expired. Please login again.'
            : 'Invalid authentication token.';
        return res.status(401).json({ success: false, message });
    }
}

/**
 * Returns middleware that checks req.user.role is in the allowed list.
 * Must be used AFTER requireAuth.
 */
function requireRole(...allowedRoles) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
            });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
