'use strict';

/**
 * GramSetu – Database Migration Runner
 *
 * Usage (from backend/ directory):
 *   node database/run_migrations.js
 *   npm run db:migrate
 *
 * Applies all .sql files in database/migrations/ that have not yet been
 * recorded in migration_history, in alphabetical (numeric prefix) order.
 * Each migration runs inside a transaction; failure rolls back and halts.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

/**
 * Creates migration_history table if it does not already exist.
 * Called before reading migration files so the table is always present.
 */
async function ensureMigrationHistory(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS migration_history (
            id           SERIAL       PRIMARY KEY,
            filename     VARCHAR(200) NOT NULL UNIQUE,
            applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
}

/**
 * Returns a Set of filenames that have already been applied.
 */
async function getAppliedMigrations(client) {
    const result = await client.query(
        'SELECT filename FROM migration_history ORDER BY filename'
    );
    return new Set(result.rows.map(r => r.filename));
}

async function main() {
    console.log('\n🗄️  GramSetu Migration Runner');
    console.log('================================');
    console.log(`Database : ${process.env.DB_NAME}`);
    console.log(`Host     : ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}\n`);

    const client = await pool.connect();

    try {
        // Ensure the tracker table exists before anything else
        await ensureMigrationHistory(client);

        const applied = await getAppliedMigrations(client);

        // Read all .sql files sorted alphabetically
        const allFiles = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        const pending = allFiles.filter(f => !applied.has(f));

        if (pending.length === 0) {
            console.log('✅  All migrations are already applied. Nothing to do.\n');
            return;
        }

        console.log(`📦  Found ${allFiles.length} migration file(s). Applying ${pending.length} pending:\n`);

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
                console.error(`     Error: ${err.message}\n`);
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
    console.error('\n❌  Migration runner error:', err.message, '\n');
    process.exit(1);
});
