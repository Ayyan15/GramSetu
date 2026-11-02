'use strict';

/**
 * GramSetu – Database Seed Runner
 *
 * Canonical path: backend/src/database/run_seeds.js
 *
 * Usage (from backend/ directory):
 *   node src/database/run_seeds.js
 *   npm run db:seed
 *
 * All seed files must be idempotent (INSERT ... ON CONFLICT DO NOTHING).
 * Safe to run multiple times.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const SEEDS_DIR = path.join(__dirname, '..', '..', 'database', 'seeds');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function main() {
    console.log('\n🌱  GramSetu Seed Runner');
    console.log('=========================');
    console.log(`Database : ${process.env.DB_NAME}`);
    console.log(`Host     : ${process.env.DB_HOST}:${process.env.DB_PORT || 5432}`);
    console.log(`Dir      : ${SEEDS_DIR}\n`);

    if (!fs.existsSync(SEEDS_DIR)) {
        console.error(`❌  Seeds directory not found: ${SEEDS_DIR}\n`);
        process.exit(1);
    }

    const client = await pool.connect();

    try {
        const files = fs.readdirSync(SEEDS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('⚠️   No seed files found.\n');
            return;
        }

        console.log(`📦  Running ${files.length} seed file(s):\n`);

        for (const filename of files) {
            const filepath = path.join(SEEDS_DIR, filename);
            const sql = fs.readFileSync(filepath, 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('COMMIT');
                console.log(`  ✅  ${filename}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`\n  ❌  ${filename}`);
                console.error(`     Error: ${err.message}\n`);
                process.exit(1);
            }
        }

        console.log('\n✅  All seeds applied successfully.\n');

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('\n❌  Seed runner error:', err.message, '\n');
    process.exit(1);
});
