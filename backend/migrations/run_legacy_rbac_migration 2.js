/**
 * Run Legacy RBAC Tables Migration
 * Applies schema changes to rol, permiso, and usuariorol tables
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Starting Legacy RBAC tables migration...\n');

    // Adjust path to point to legacy/sql-migrations
    const migrationPath = path.join(__dirname, '../legacy/sql-migrations/create_rbac_tables.sql');
    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            console.log('📄 Executing create_rbac_tables.sql...');
            // Execute migration
            await client.query(sql);

            await client.query('COMMIT');

            console.log('✅ RBAC migration completed successfully!\n');

            // Verification
            console.log('📋 Verifying changes...\n');

            // Check columns added to rol
            const columns = await client.query(`
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = 'rol' 
                AND column_name IN ('scope', 'tenant_id', 'display_name')
            `);
            console.log('New columns in rol:');
            columns.rows.forEach(c => {
                console.log(`  - ${c.column_name} (${c.data_type})`);
            });

            console.log('\n✨ RBAC tables migration complete!');

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Migration failed:', error.message);
            console.error(error);
            process.exit(1);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error loading SQL file:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
