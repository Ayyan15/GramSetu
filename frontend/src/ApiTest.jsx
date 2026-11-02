import { useState } from "react";
import { checkBackendHealth } from "./services/api";

function ApiTest() {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function testConnection() {
        setLoading(true);
        setError("");
        setResult(null);

        try {
            const data = await checkBackendHealth();
            setResult(data);
        } catch {
            setError(
                "Could not connect to the backend. Check that the server is running."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
            <h1>GramSetu API Connection Test</h1>

            <button onClick={testConnection} disabled={loading}>
                {loading ? "Testing..." : "Test Backend Connection"}
            </button>

            {result && (
                <pre style={{ marginTop: "20px" }}>
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}

            {error && (
                <p style={{ color: "red", marginTop: "20px" }}>{error}</p>
            )}
        </div>
    );
}

export default ApiTest;