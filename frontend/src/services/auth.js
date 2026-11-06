/**
 * GramSetu – Auth Token Storage
 *
 * Uses localStorage — works in both browser and Capacitor WebView.
 * Keys are prefixed with "gs_" to avoid collisions.
 */

const TOKEN_KEY = 'gs_token';
const USER_KEY  = 'gs_user';

/** Save token and user object after successful login */
export function saveAuth(token, user) {
    try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
        console.warn('[auth] localStorage write failed:', e.message);
    }
}

/** Load saved auth — returns { token, user } or { token: null, user: null } */
export function loadAuth() {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const raw   = localStorage.getItem(USER_KEY);
        const user  = raw ? JSON.parse(raw) : null;
        return { token, user };
    } catch (e) {
        console.warn('[auth] localStorage read failed:', e.message);
        return { token: null, user: null };
    }
}

/** Clear saved auth on logout */
export function clearAuth() {
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    } catch (e) {
        console.warn('[auth] localStorage clear failed:', e.message);
    }
}

/** Check if a token exists (does not verify expiry — server will reject expired tokens) */
export function isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
}

/** Get stored token only */
export function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
}
