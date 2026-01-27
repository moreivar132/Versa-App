/**
 * Run B2B Invite Flow Migration
 * Applies changes to saas_invite table and related indexes
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Starting B2B invite flow migration...\n');

    const migrationPath = path.join(__dirname, '20260117_b2b_invite_flow.sql');
    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Execute migration
            await client.query(sql);

            await client.query('COMMIT');

            console.log('✅ Migration completed successfully!\n');

            // Verification
            console.log('📋 Verifying changes...\n');

            // Check columns added to saas_invite
            const columns = await client.query(`
                SELECT column_name, data_type
                FROM information_schema.columns 
                WHERE table_name = 'saas_invite' 
                AND column_name IN ('id_empresa', 'used_by_user_id')
            `);
            console.log('New columns in saas_invite:');
            columns.rows.forEach(c => {
                console.log(`  - ${c.column_name} (${c.data_type})`);
            });

            console.log('\n✨ B2B invite migration complete!');

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
