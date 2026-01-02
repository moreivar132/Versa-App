/**
 * VERSA - Email Config Migration Runner
 * Executes the email_config table migration
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
        console.log('🔄 Running email_config migration...');

        const sql = fs.readFileSync(
            path.join(__dirname, 'migrations/create_email_config.sql'),
            'utf8'
        );

        await client.query(sql);
        console.log('✅ email_config table created successfully!');

        // Insert default config for tenant 1 if not exists
        await client.query(`
            INSERT INTO email_config (id_tenant, sender_name, sender_email)
            VALUES (1, 'VERSA Taller', 'noreply@goversa.es')
            ON CONFLICT (id_tenant) DO NOTHING
        `);
        console.log('✅ Default config for tenant 1 created');

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
