const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool            = require("./config/db");
const authRoutes       = require("./routes/auth.routes");
const usersRoutes      = require("./routes/users.routes");
const servicesRoutes   = require("./routes/services.routes");
const adminRoutes      = require("./routes/admin.routes");
const applicationsRoutes = require("./routes/applications.routes");
const grievancesRoutes = require("./routes/grievances.routes");

const app  = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/users",        usersRoutes);
app.use("/api/services",     servicesRoutes);
app.use("/api/admin",        adminRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/grievances",   grievancesRoutes);


// Health-check API
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to GramSetu API!",
        status: "Backend is running",
    });
});

// API health-check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "GramSetu backend is healthy",
        timestamp: new Date().toISOString(),
    });
});

app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database() AS database_name, NOW() AS server_time"
        );

        res.json({
            success: true,
            message: "PostgreSQL connection successful!",
            database: result.rows[0].database_name,
            serverTime: result.rows[0].server_time,
        });
    } catch (error) {
        console.error("Database test failed:", {
            message: error.message,
            code: error.code,
        });

        res.status(500).json({
            success: false,
            message: "Database connection failed.",
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`GramSetu server running at http://localhost:${PORT}`);
});