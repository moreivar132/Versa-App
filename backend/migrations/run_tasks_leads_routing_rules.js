/**
 * Migration: Create Lead Routing Rules table
 * Phase 3: Automatic Assignment based on tags
 * 
 * Run manually with: node backend/migrations/run_tasks_leads_routing_rules.js
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
        console.log('🔄 Starting Tasks & Leads Phase 3 Migration (Routing Rules)...');

        await client.query('BEGIN');

        // Create Routing Rules Table
        const createTable = `
            CREATE TABLE IF NOT EXISTS tasksleads_routing_rule (
                id SERIAL PRIMARY KEY,
                id_tenant INTEGER NOT NULL DEFAULT 1,
                tag VARCHAR(50) NOT NULL,
                user_id INTEGER NOT NULL REFERENCES usuario(id),
                notify_email BOOLEAN DEFAULT true,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                
                CONSTRAINT unique_tenant_tag UNIQUE (id_tenant, tag)
            );

            CREATE INDEX IF NOT EXISTS idx_routing_rule_tenant_active 
            ON tasksleads_routing_rule (id_tenant, is_active) 
            WHERE is_active = true;
        `;
        await client.query(createTable);
        console.log('✅ Created/verified tasksleads_routing_rule table');

        await client.query('COMMIT');
        console.log('🎉 Phase 3 Migration completed successfully!');

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
