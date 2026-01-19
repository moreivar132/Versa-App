/**
 * Run OAuth Accounts Migration
 * Creates oauth_account table for Google OAuth
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Running OAuth Accounts Migration...\n');

    const migrationPath = path.join(__dirname, '20260117_oauth_accounts.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        await pool.query(sql);
        console.log('✅ oauth_account table created successfully');

        // Verify table exists
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'oauth_account'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 oauth_account columns:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });

        console.log('\n✅ Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
