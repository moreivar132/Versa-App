/**
 * Migration: Add missing columns to Tasks & Leads tables
 * 
 * Run manually with: node backend/migrations/run_tasksleads_columns_migration.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🔄 Starting Tasks & Leads columns migration...');

        await client.query('BEGIN');

        // Add missing columns to tasksleads_lead
        const alterLeadTable = `
            -- Add source column if not exists
            ALTER TABLE tasksleads_lead ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
            
            -- Add channel column if not exists
            ALTER TABLE tasksleads_lead ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'unknown';
            
            -- Add last_activity_at column if not exists
            ALTER TABLE tasksleads_lead ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;
            
            -- Add last_message_preview column if not exists
            ALTER TABLE tasksleads_lead ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
            
            -- Add updated_at column if not exists
            ALTER TABLE tasksleads_lead ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
        `;

        await client.query(alterLeadTable);
        console.log('✅ Added missing columns to tasksleads_lead');

        // Create tasksleads_lead_timeline_link table if not exists
        const createLinkTable = `
            CREATE TABLE IF NOT EXISTS tasksleads_lead_timeline_link (
                id SERIAL PRIMARY KEY,
                id_tenant INTEGER NOT NULL,
                lead_id INTEGER NOT NULL REFERENCES tasksleads_lead(id) ON DELETE CASCADE,
                timeline_external_id VARCHAR(255) NOT NULL,
                timeline_phone VARCHAR(50),
                last_sync_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(timeline_external_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_timeline_link_external_id ON tasksleads_lead_timeline_link(timeline_external_id);
            CREATE INDEX IF NOT EXISTS idx_timeline_link_lead_id ON tasksleads_lead_timeline_link(lead_id);
        `;

        await client.query(createLinkTable);
        console.log('✅ Created/verified tasksleads_lead_timeline_link table');

        // Create tasksleads_webhook_event table if not exists (for deduplication)
        const createWebhookEventTable = `
            CREATE TABLE IF NOT EXISTS tasksleads_webhook_event (
                id SERIAL PRIMARY KEY,
                external_event_id VARCHAR(255) UNIQUE NOT NULL,
                event_type VARCHAR(100),
                payload JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_webhook_event_external_id ON tasksleads_webhook_event(external_event_id);
        `;

        await client.query(createWebhookEventTable);
        console.log('✅ Created/verified tasksleads_webhook_event table');

        await client.query('COMMIT');
        console.log('🎉 Migration completed successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
