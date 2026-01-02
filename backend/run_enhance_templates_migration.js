/**
 * VERSA - Email Templates Enhancement Migration Runner
 * Adds columns for user-created templates
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🔄 Running email templates enhancement migration...');

        const sql = fs.readFileSync(
            path.join(__dirname, 'migrations/enhance_email_templates.sql'),
            'utf8'
        );

        await client.query(sql);
        console.log('✅ Email templates enhanced successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('🎉 Migration complete!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration error:', err);
        process.exit(1);
    });
