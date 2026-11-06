'use strict';

/**
 * GramSetu – Input Validators
 *
 * Pure validation functions. No database calls, no side effects.
 * All return { valid: boolean, message: string }.
 */

/**
 * Validates a full name.
 * Allows Unicode letters (handles Indian names in Devanagari etc.), spaces, hyphens, apostrophes.
 */
function validateFullName(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Full name is required.' };
    }
    const trimmed = value.trim();
    if (trimmed.length < 2) {
        return { valid: false, message: 'Full name must be at least 2 characters.' };
    }
    if (trimmed.length > 150) {
        return { valid: false, message: 'Full name must not exceed 150 characters.' };
    }
    // Allows letters (including Unicode), spaces, hyphens, apostrophes
    if (!/^[\p{L}\s'\-]+$/u.test(trimmed)) {
        return { valid: false, message: 'Full name contains invalid characters.' };
    }
    return { valid: true, message: '' };
}

/**
 * Validates an email address.
 * RFC 5321-compatible pattern; normalised to lowercase by caller.
 */
function validateEmail(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Email address is required.' };
    }
    const trimmed = value.trim();
    if (trimmed.length > 254) {
        return { valid: false, message: 'Email address is too long.' };
    }
    // Standard email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) {
        return { valid: false, message: 'Please provide a valid email address.' };
    }
    return { valid: true, message: '' };
}

/**
 * Validates an Indian mobile number.
 * Rules: exactly 10 digits, first digit must be 6, 7, 8, or 9.
 * Strips common formatting characters (spaces, hyphens, +91) before testing.
 */
function validateMobile(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Mobile number is required.' };
    }

    // Remove spaces, hyphens, and optional +91 country code
    let digits = value.trim().replace(/[\s\-]/g, '');
    if (digits.startsWith('+91')) {
        digits = digits.slice(3);
    } else if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.slice(2);
    }

    if (!/^\d{10}$/.test(digits)) {
        return { valid: false, message: 'Mobile number must be exactly 10 digits.' };
    }
    if (!/^[6-9]/.test(digits)) {
        return { valid: false, message: 'Mobile number must start with 6, 7, 8, or 9.' };
    }
    return { valid: true, message: '', normalised: digits };
}

/**
 * Validates password strength.
 * Minimum 8 chars, at least one uppercase, one lowercase, one digit.
 */
function validatePassword(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Password is required.' };
    }
    if (value.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters.' };
    }
    if (value.length > 128) {
        return { valid: false, message: 'Password must not exceed 128 characters.' };
    }
    if (!/[A-Z]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }
    if (!/[a-z]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    }
    if (!/[0-9]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }
    return { valid: true, message: '' };
}

module.exports = { validateFullName, validateEmail, validateMobile, validatePassword };
