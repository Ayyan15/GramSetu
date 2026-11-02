const API_BASE_URL = "http://localhost:5000";

export async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        return data;
    } catch (error) {
        console.error("GramSetu API connection failed:", error);
        throw error;
    }
}

export default API_BASE_URL;