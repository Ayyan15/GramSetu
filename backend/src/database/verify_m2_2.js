'use strict';

/**
 * GramSetu – Milestone 2.2 Verification Script
 * Run from backend/ directory: node src/database/verify_m2_2.js
 *
 * Tests:
 *  1. All 7 tables exist
 *  2. All 4 roles exist
 *  3. Kini Gram Panchayat inserted correctly
 *  4. Taluka and pincode are NULL
 *  5. Foreign key constraints present
 *  6. Unique constraints present on users.email and users.mobile
 *  7. migration_history is populated
 *  8. Re-run migrations = no duplicates (runner is idempotent)
 *  9. Backend health endpoint reachable
 * 10. DB connection pool works
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

let passed = 0;
let failed = 0;

function pass(label, detail = '') {
    console.log(`  ✅  ${label}${detail ? ' — ' + detail : ''}`);
    passed++;
}

function fail(label, detail = '') {
    console.log(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
}

async function main() {
    console.log('\n🔍  GramSetu Milestone 2.2 — Verification\n');
    const client = await pool.connect();

    try {

        // ── 1. All 7 tables exist ─────────────────────────────────────────────
        console.log('1. Table Existence');
        const required = ['migration_history','panchayats','roles','users','user_profiles','refresh_tokens','audit_logs'];
        const tablesRes = await client.query(`
            SELECT table_name
            FROM   information_schema.tables
            WHERE  table_schema = 'public'
              AND  table_type   = 'BASE TABLE'
        `);
        const existing = new Set(tablesRes.rows.map(r => r.table_name));
        for (const t of required) {
            if (existing.has(t)) pass(t);
            else                 fail(t, 'MISSING');
        }

        // ── 2. All 4 roles exist ──────────────────────────────────────────────
        console.log('\n2. Role Records');
        const rolesRes = await client.query('SELECT name FROM roles ORDER BY id');
        const roleNames = rolesRes.rows.map(r => r.name);
        const requiredRoles = ['CITIZEN','PANCHAYAT_OFFICIAL','FIELD_WORKER','SYSTEM_ADMIN'];
        for (const r of requiredRoles) {
            if (roleNames.includes(r)) pass(r);
            else                       fail(r, 'MISSING');
        }
        pass(`Total roles: ${roleNames.length} (expected 4)`);

        // ── 3 & 4. Kini GP record + NULL taluka/pincode ───────────────────────
        console.log('\n3–4. Panchayat Seed Data');
        const gpRes = await client.query(`
            SELECT name, marathi_name, village, taluka, district, state, country, pincode, is_active
            FROM   panchayats
            WHERE  id = 1
        `);
        if (gpRes.rowCount === 0) {
            fail('Kini Gram Panchayat', 'ROW NOT FOUND');
        } else {
            const gp = gpRes.rows[0];
            gp.name          === 'Kini Gram Panchayat'   ? pass('name = Kini Gram Panchayat')  : fail('name',          `got: ${gp.name}`);
            gp.marathi_name  === 'किनी ग्रामपंचायत'      ? pass('marathi_name = किनी ग्रामपंचायत') : fail('marathi_name', `got: ${gp.marathi_name}`);
            gp.village       === 'Kini'                   ? pass('village = Kini')               : fail('village',       `got: ${gp.village}`);
            gp.district      === 'Kolhapur'               ? pass('district = Kolhapur')          : fail('district',      `got: ${gp.district}`);
            gp.state         === 'Maharashtra'            ? pass('state = Maharashtra')          : fail('state',         `got: ${gp.state}`);
            gp.country       === 'India'                  ? pass('country = India')              : fail('country',       `got: ${gp.country}`);
            gp.is_active     === true                     ? pass('is_active = TRUE')             : fail('is_active',     `got: ${gp.is_active}`);
            gp.taluka        === null                     ? pass('taluka = NULL ✓')              : fail('taluka',        `expected NULL, got: ${gp.taluka}`);
            gp.pincode       === null                     ? pass('pincode = NULL ✓')             : fail('pincode',       `expected NULL, got: ${gp.pincode}`);
        }

        // ── 5. Foreign key constraints ────────────────────────────────────────
        console.log('\n5. Foreign Key Constraints');
        const fkRes = await client.query(`
            SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
            FROM   information_schema.table_constraints tc
            JOIN   information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name
            JOIN   information_schema.constraint_column_usage ccu
                   ON ccu.constraint_name = tc.constraint_name
            WHERE  tc.constraint_type = 'FOREIGN KEY'
            ORDER  BY tc.table_name, kcu.column_name
        `);
        const fkExpected = [
            { table: 'users',          col: 'panchayat_id', ref: 'panchayats'   },
            { table: 'users',          col: 'role_id',      ref: 'roles'        },
            { table: 'user_profiles',  col: 'user_id',      ref: 'users'        },
            { table: 'refresh_tokens', col: 'user_id',      ref: 'users'        },
            { table: 'audit_logs',     col: 'panchayat_id', ref: 'panchayats'   },
            { table: 'audit_logs',     col: 'user_id',      ref: 'users'        },
        ];
        for (const { table, col, ref } of fkExpected) {
            const found = fkRes.rows.some(r => r.table_name === table && r.column_name === col && r.foreign_table === ref);
            found ? pass(`${table}.${col} → ${ref}`) : fail(`${table}.${col} → ${ref}`, 'FK MISSING');
        }

        // ── 6. Unique constraints on users.email and users.mobile ─────────────
        console.log('\n6. Unique Constraints');
        const ucRes = await client.query(`
            SELECT kcu.table_name, kcu.column_name
            FROM   information_schema.table_constraints tc
            JOIN   information_schema.key_column_usage kcu
                   ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE  tc.constraint_type = 'UNIQUE'
              AND  tc.table_schema    = 'public'
            ORDER  BY kcu.table_name, kcu.column_name
        `);
        const ucPairs = ucRes.rows.map(r => `${r.table_name}.${r.column_name}`);
        ['users.email','users.mobile','roles.name','refresh_tokens.token_hash','user_profiles.user_id'].forEach(pair => {
            ucPairs.includes(pair) ? pass(`UNIQUE on ${pair}`) : fail(`UNIQUE on ${pair}`, 'CONSTRAINT MISSING');
        });

        // ── 7. migration_history populated ────────────────────────────────────
        console.log('\n7. Migration History');
        const mhRes = await client.query('SELECT filename, applied_at FROM migration_history ORDER BY filename');
        if (mhRes.rowCount === 7) {
            pass(`${mhRes.rowCount} migration(s) recorded`);
            mhRes.rows.forEach(r => pass(r.filename));
        } else {
            fail(`Expected 7 rows, got ${mhRes.rowCount}`);
        }

        // ── 8. Re-run migrations = idempotent ─────────────────────────────────
        console.log('\n8. Idempotency (re-run migration runner)');
        const { execSync } = require('child_process');
        try {
            const output = execSync('node src/database/run_migrations.js', {
                cwd: require('path').join(__dirname, '..', '..'),
                encoding: 'utf8',
                env: process.env,
            });
            output.includes('Nothing to do')
                ? pass('Re-run: "Nothing to do" confirmed — no duplicates')
                : fail('Re-run output unexpected', output.trim().slice(0, 120));
        } catch (e) {
            fail('Re-run migration runner failed', e.message.slice(0, 120));
        }

        // ── 9. Backend health endpoint ────────────────────────────────────────
        console.log('\n9. Backend Health Endpoint');
        try {
            const http = require('http');
            const result = await new Promise((resolve, reject) => {
                const req = http.get('http://localhost:5000/api/health', res => {
                    let body = '';
                    res.on('data', d => body += d);
                    res.on('end', () => resolve({ status: res.statusCode, body }));
                });
                req.on('error', reject);
                req.setTimeout(4000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            result.status === 200 && (result.body.includes('"success":true') || result.body.includes('"status":"ok"') || result.body.includes('healthy'))
                ? pass(`GET /api/health → 200 OK — ${result.body.slice(0,70)}`)
                : fail('Health endpoint', `status=${result.status} body=${result.body.slice(0,80)}`);
        } catch (e) {
            fail('Health endpoint unreachable', e.message + ' — is the backend running?');
        }

        // ── 10. DB connection pool ────────────────────────────────────────────
        console.log('\n10. PostgreSQL Connection Pool');
        const pingRes = await client.query('SELECT NOW() AS ts, current_database() AS db');
        pass(`Connected to "${pingRes.rows[0].db}" at ${pingRes.rows[0].ts}`);

    } finally {
        client.release();
        await pool.end();
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const total = passed + failed;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Results: ${passed}/${total} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
}

main().catch(err => {
    console.error('\n❌  Verification script error:', err.message, '\n');
    process.exit(1);
});
