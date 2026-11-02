'use strict';

/**
 * GramSetu – Database Migration Runner
 *
 * Canonical path: backend/src/database/run_migrations.js
 *
 * Usage (from backend/ directory):
 *   node src/database/run_migrations.js
 *   npm run db:migrate
 *
 * What it does:
 *   - Ensures migration_history table exists.
 *   - Reads all .sql files from backend/database/migrations/ in alphabetical order.
 *   - Skips files already recorded in migration_history.
 *   - Applies each pending migration in its own transaction.
 *   - Records success in migration_history.
 *   - Halts and reports on first failure (rolls back that transaction).
 *
 * No external dependencies beyond the existing `pg` package.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// SQL migration files live in backend/database/migrations/
// This script lives in backend/src/database/ — two levels up to reach backend/
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureMigrationHistory(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS migration_history (
            id           SERIAL       PRIMARY KEY,
            filename     VARCHAR(200) NOT NULL UNIQUE,
            applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
}

async function getAppliedMigrations(client) {
    const result = await client.query(
        'SELECT filename FROM migration_history ORDER BY filename'
    );
    return new Set(result.rows.map(r => r.filename));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n🗄️  GramSetu Migration Runner');
    console.log('================================');
    console.log(`Database : ${process.env.DB_NAME}`);
    console.log(`Host     : ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}`);
    console.log(`Dir      : ${MIGRATIONS_DIR}\n`);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`❌  Migrations directory not found: ${MIGRATIONS_DIR}\n`);
        process.exit(1);
    }

    const client = await pool.connect();

    try {
        // Create tracker table if this is the very first run
        await ensureMigrationHistory(client);

        const applied = await getAppliedMigrations(client);

        const allFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        const pending = allFiles.filter(f => !applied.has(f));

        if (pending.length === 0) {
            console.log('✅  All migrations are already applied. Nothing to do.\n');
            return;
        }

        console.log(`📦  ${allFiles.length} migration file(s) found. Applying ${pending.length} pending:\n`);

        for (const filename of pending) {
            const filepath = path.join(MIGRATIONS_DIR, filename);
            const sql = fs.readFileSync(filepath, 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO migration_history (filename) VALUES ($1)',
                    [filename]
                );
                await client.query('COMMIT');
                console.log(`  ✅  ${filename}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`\n  ❌  ${filename}`);
                console.error(`     Error: ${err.message}`);
                console.error('     Migration halted. Fix the error and re-run.\n');
                process.exit(1);
            }
        }

        console.log('\n✅  All pending migrations applied successfully.\n');

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('\n❌  Migration runner fatal error:', err.message, '\n');
    process.exit(1);
});
