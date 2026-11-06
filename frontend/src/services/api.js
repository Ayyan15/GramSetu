import { getToken } from './auth';

const API_BASE_URL = "http://localhost:5000";

/** Generic authenticated fetch helper — attaches Bearer token automatically */
async function authFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
        throw Object.assign(
            new Error(data.message || `Request failed (${response.status})`),
            { status: response.status, data }
        );
    }
    return data;
}

export async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("GramSetu API connection failed:", error);
        throw error;
    }
}

/**
 * Citizen self-registration.
 * @param {{ full_name: string, email: string, mobile: string, password: string, confirm_password: string }} payload
 */
export async function registerCitizen(payload) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
        throw Object.assign(new Error(data.message || "Registration failed."), { status: response.status, data });
    }
    return data;
}

/**
 * Login for all roles.
 * @param {string} identifier  Email or mobile number
 * @param {string} password
 * @returns {Promise<{ success: boolean, token: string, user: object }>}
 */
export async function loginUser(identifier, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ identifier, password }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw Object.assign(new Error(data.message || "Login failed."), { status: response.status, data });
    }
    return data;
}

/** GET /api/users/me — authenticated user's full profile */
export function getMyProfile() {
    return authFetch('/api/users/me');
}

/** GET /api/services — list of active Panchayat services */
export function getServices() {
    return authFetch('/api/services');
}

export default API_BASE_URL;
