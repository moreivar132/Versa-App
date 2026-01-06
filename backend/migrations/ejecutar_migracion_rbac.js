/**
 * RBAC Migration Runner
 * Executes the SQL migration for RBAC multi-tenant tables
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Starting RBAC tables migration...\n');

    try {
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'create_rbac_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute migration
        await pool.query(sql);

        console.log('✅ RBAC tables migration completed successfully!\n');
        console.log('📋 Changes applied:');
        console.log('   - Enhanced rol table with scope, tenant_id, level, is_system, display_name');
        console.log('   - Enhanced permiso table with key and module columns');
        console.log('   - Added tenant_id to usuariorol table');
        console.log('   - Created audit_logs table');
        console.log('   - Created user_has_permission() function');
        console.log('   - Added unique indexes and constraints\n');

        // Verify migration
        console.log('🔍 Verifying migration...');

        const rolCols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'rol' AND column_name IN ('scope', 'tenant_id', 'level', 'is_system')
        `);
        console.log(`   - rol table has ${rolCols.rows.length}/4 new columns`);

        const auditExists = await pool.query(`
            SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
        `);
        console.log(`   - audit_logs table exists: ${auditExists.rows[0].exists}`);

        const funcExists = await pool.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'user_has_permission'
            )
        `);
        console.log(`   - user_has_permission function exists: ${funcExists.rows[0].exists}`);

        console.log('\n✨ Migration verification complete!');
        console.log('\n📢 Next step: Run seed_rbac_permissions.js to populate permissions catalog');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
