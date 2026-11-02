'use strict';

/**
 * GramSetu – First System Administrator Bootstrap
 *
 * Usage (from backend/ directory):
 *   node database/bootstrap_admin.js
 *   npm run db:bootstrap
 *
 * SECURITY RULES:
 *   - Run this ONCE after migrations and seeds are applied.
 *   - Script is idempotent: exits safely if a SYSTEM_ADMIN already exists.
 *   - Credentials are entered interactively. They are NEVER passed as CLI args.
 *   - This script is for initial deployment ONLY. All subsequent admin accounts
 *     are created through the authenticated Admin API.
 *
 * Prerequisites:
 *   npm run db:migrate
 *   npm run db:seed
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const BCRYPT_ROUNDS = 12;

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ─── Interactive Input Helpers ────────────────────────────────────────────────

function prompt(question) {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input:  process.stdin,
            output: process.stdout,
        });
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function promptPassword(question) {
    return new Promise(resolve => {
        process.stdout.write(question);
        let password = '';

        const onData = (ch) => {
            ch = ch.toString();
            if (ch === '\n' || ch === '\r' || ch === '\u0004') {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdin.removeListener('data', onData);
                process.stdout.write('\n');
                resolve(password);
            } else if (ch === '\u0003') {
                // Ctrl+C
                process.stdout.write('\n');
                process.exit(0);
            } else if (ch === '\u007f' || ch === '\b') {
                // Backspace
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    process.stdout.write(question + '*'.repeat(password.length));
                }
            } else {
                password += ch;
                process.stdout.write('*');
            }
        };

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', onData);
    });
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidMobile(mobile) {
    return /^[6-9]\d{9}$/.test(mobile);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n👑  GramSetu – System Administrator Bootstrap');
    console.log('================================================');
    console.log('This script creates the first SYSTEM_ADMIN account.');
    console.log('It is idempotent: nothing happens if an admin already exists.\n');

    const client = await pool.connect();

    try {
        // ── 1. Guard: check if admin already exists ──────────────────────────
        const existingAdmin = await client.query(`
            SELECT u.id
            FROM   users u
            JOIN   roles r ON r.id = u.role_id
            WHERE  r.name = 'SYSTEM_ADMIN'
              AND  u.is_active = TRUE
            LIMIT  1
        `);

        if (existingAdmin.rowCount > 0) {
            console.log('✅  A SYSTEM_ADMIN account already exists.');
            console.log('    Bootstrap aborted — no changes made.\n');
            return;
        }

        // ── 2. Verify prerequisites are in place ─────────────────────────────
        const panchayat = await client.query(
            'SELECT id, name FROM panchayats WHERE is_active = TRUE LIMIT 1'
        );
        if (panchayat.rowCount === 0) {
            console.error('❌  No active panchayat found.');
            console.error('    Run `npm run db:seed` first.\n');
            process.exit(1);
        }

        const adminRole = await client.query(
            "SELECT id FROM roles WHERE name = 'SYSTEM_ADMIN' LIMIT 1"
        );
        if (adminRole.rowCount === 0) {
            console.error('❌  SYSTEM_ADMIN role not found.');
            console.error('    Run `npm run db:seed` first.\n');
            process.exit(1);
        }

        const panchayatId  = panchayat.rows[0].id;
        const panchayatName = panchayat.rows[0].name;
        const adminRoleId  = adminRole.rows[0].id;

        console.log(`📍  Panchayat : ${panchayatName} (id=${panchayatId})`);
        console.log('    Enter the details for the first System Administrator.\n');

        // ── 3. Collect credentials interactively ─────────────────────────────
        let fullName, email, mobile, password, confirmPassword;

        fullName = await prompt('   Full Name   : ');
        if (!fullName || fullName.length < 2) {
            console.error('\n❌  Full name must be at least 2 characters.\n');
            process.exit(1);
        }

        email = await prompt('   Email       : ');
        if (!isValidEmail(email)) {
            console.error('\n❌  Invalid email address.\n');
            process.exit(1);
        }

        mobile = await prompt('   Mobile (10-digit Indian number) : ');
        if (!isValidMobile(mobile)) {
            console.error('\n❌  Invalid mobile number. Must be a 10-digit Indian number starting with 6-9.\n');
            process.exit(1);
        }

        password = await promptPassword('   Password    : ');
        if (password.length < 8) {
            console.error('\n❌  Password must be at least 8 characters.\n');
            process.exit(1);
        }

        confirmPassword = await promptPassword('   Confirm pwd : ');
        if (password !== confirmPassword) {
            console.error('\n❌  Passwords do not match.\n');
            process.exit(1);
        }

        // ── 4. Hash password ──────────────────────────────────────────────────
        console.log('\n   Hashing password...');
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // ── 5. Insert user + profile inside a transaction ─────────────────────
        await client.query('BEGIN');

        const userResult = await client.query(`
            INSERT INTO users (panchayat_id, role_id, email, mobile, password_hash, is_active, is_email_verified)
            VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
            RETURNING id
        `, [panchayatId, adminRoleId, email.toLowerCase(), mobile, passwordHash]);

        const userId = userResult.rows[0].id;

        await client.query(`
            INSERT INTO user_profiles (user_id, full_name)
            VALUES ($1, $2)
        `, [userId, fullName]);

        // Audit log entry
        await client.query(`
            INSERT INTO audit_logs (user_id, panchayat_id, action, entity_type, entity_id, new_values)
            VALUES ($1, $2, 'SYSTEM_ADMIN_BOOTSTRAPPED', 'user', $3, $4)
        `, [
            userId,
            panchayatId,
            userId,
            JSON.stringify({ email, mobile, full_name: fullName, role: 'SYSTEM_ADMIN' }),
        ]);

        await client.query('COMMIT');

        // ── 6. Confirmation ───────────────────────────────────────────────────
        console.log('\n✅  System Administrator created successfully!');
        console.log('───────────────────────────────────────────────');
        console.log(`   User ID   : ${userId}`);
        console.log(`   Full Name : ${fullName}`);
        console.log(`   Email     : ${email.toLowerCase()}`);
        console.log(`   Mobile    : ${mobile}`);
        console.log(`   Role      : SYSTEM_ADMIN`);
        console.log(`   Panchayat : ${panchayatName}`);
        console.log('\n   ⚠️  Keep these credentials secure.');
        console.log('   You can now login via the GramSetu Admin interface.\n');

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('\n❌  Bootstrap failed:', err.message, '\n');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('\n❌  Unexpected error:', err.message, '\n');
    process.exit(1);
});
