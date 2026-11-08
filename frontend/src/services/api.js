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

/** GET /api/notifications */
export function getNotifications(options = {}) {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    const query = params.toString();
    return authFetch(`/api/notifications${query ? `?${query}` : ''}`);
}

/** GET /api/notifications/unread-count */
export function getUnreadNotificationCount() {
    return authFetch('/api/notifications/unread-count');
}

/** PATCH /api/notifications/:id/read */
export function markNotificationAsRead(id) {
    return authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

/** PATCH /api/notifications/read-all */
export function markAllNotificationsAsRead() {
    return authFetch('/api/notifications/read-all', { method: 'PATCH' });
}

/** GET /api/applications — applications visible to the authenticated user */
export function getApplications() {
    return authFetch('/api/applications');
}

/** POST /api/applications — submit a citizen service application */
export function submitApplication(payload) {
    return authFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/** GET /api/grievances */
export function getGrievances(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    const query = params.toString();
    return authFetch(`/api/grievances${query ? `?${query}` : ''}`);
}

/** POST /api/grievances */
export function createGrievance(payload) {
    return authFetch('/api/grievances', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/** GET /api/grievances/workers */
export function getGrievanceWorkers() {
    return authFetch('/api/grievances/workers');
}

/** PATCH /api/grievances/:id/assign */
export function assignGrievance(id, assignedTo) {
    return authFetch(`/api/grievances/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to: assignedTo }),
    });
}

/** PATCH /api/grievances/:id/status */
export function updateGrievanceStatus(id, payload) {
    return authFetch(`/api/grievances/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

/** GET /api/grievances/:id/attachments */
export function getGrievanceAttachments(id) {
    return authFetch(`/api/grievances/${id}/attachments`);
}

/** POST /api/grievances/:id/attachments */
export async function uploadGrievanceAttachment(id, file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('attachment', file);
    const response = await fetch(`${API_BASE_URL}/api/grievances/${id}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
        throw Object.assign(new Error(data.message || `Request failed (${response.status})`), {
            status: response.status,
            data,
        });
    }
    return data;
}

/** GET /api/grievances/attachments/:attachmentId/download */
export async function downloadGrievanceAttachment(id) {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/api/grievances/attachments/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch { /* non-JSON error response */ }
        throw Object.assign(new Error(data.message || `Request failed (${response.status})`), {
            status: response.status,
            data,
        });
    }
    return response.blob();
}

/** GET /api/applications/:applicationId/documents */
export function getApplicationDocuments(applicationId) {
    return authFetch(`/api/applications/${applicationId}/documents`);
}

/** POST /api/applications/:applicationId/documents */
export async function uploadApplicationDocument(applicationId, documentType, file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('document', file);
    const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
        throw Object.assign(new Error(data.message || `Request failed (${response.status})`), {
            status: response.status,
            data,
        });
    }
    return data;
}

/** PATCH /api/documents/:documentId/verification */
export function updateDocumentVerification(documentId, status, rejectionReason = '') {
    return authFetch(`/api/documents/${documentId}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    });
}

/** GET /api/documents/:documentId/download — returns an authenticated file blob */
export async function downloadDocument(documentId) {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch { /* non-JSON error response */ }
        throw Object.assign(new Error(data.message || `Request failed (${response.status})`), {
            status: response.status,
            data,
        });
    }
    return response.blob();
}

export default API_BASE_URL;
