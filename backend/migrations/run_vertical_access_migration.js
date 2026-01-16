#!/usr/bin/env node
/**
 * VERSA - Run Vertical Access Control Migration
 * 
 * Usage:
 *   node migrations/run_vertical_access_migration.js
 * 
 * This script:
 * 1. Runs the SQL migration (20260116_vertical_access_control.sql)
 * 2. Runs the seed script (seed_verticals.js)
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('='.repeat(60));
    console.log('   VERSA - Vertical Access Control Migration');
    console.log('='.repeat(60));
    console.log();

    const client = await pool.connect();

    try {
        // 1. Run SQL migration
        console.log('📋 Step 1: Running SQL migration...');

        const sqlPath = path.join(__dirname, '20260116_vertical_access_control.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('✅ SQL migration completed');
        console.log();

        // Verify tables were created
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('vertical', 'tenant_vertical', 'user_permission_override')
        `);

        console.log('📊 Created tables:');
        for (const row of tablesResult.rows) {
            console.log(`   - ${row.table_name}`);
        }
        console.log();

        // Check verticals were seeded
        const verticalsResult = await client.query('SELECT key, name FROM vertical ORDER BY display_order');
        console.log('🏷️ Verticals seeded:');
        for (const row of verticalsResult.rows) {
            console.log(`   - ${row.key}: ${row.name}`);
        }
        console.log();

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ SQL migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
    }

    // 2. Run seed script
    console.log('📋 Step 2: Running permissions seed...');
    console.log();

    try {
        const { seedVerticalPermissions } = require('./seed_verticals');
        await seedVerticalPermissions();
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
        console.error(error);
        process.exit(1);
    }

    console.log();
    console.log('='.repeat(60));
    console.log('   ✅ MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log();
    console.log('Next steps:');
    console.log('1. Restart backend server to pick up new endpoints');
    console.log('2. Test /api/me/access endpoint');
    console.log('3. Apply requireVerticalAccess to vertical routers');
    console.log();

    process.exit(0);
}

runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
