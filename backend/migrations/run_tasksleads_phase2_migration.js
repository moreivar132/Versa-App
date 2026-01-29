/**
 * Migration: Create Lead Tags and AI Profile tables
 * Phase 2: Auto-labeling & Classification
 * 
 * Run manually with: node backend/migrations/run_tasksleads_phase2_migration.js
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
        console.log('🔄 Starting Tasks & Leads Phase 2 Migration (Tags & AI)...');

        await client.query('BEGIN');

        // 1. Create Tags Table
        // Stores individual tags like BICI, TALLER, URGENTE
        const createTagsTable = `
            CREATE TABLE IF NOT EXISTS tasksleads_lead_tag (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER NOT NULL REFERENCES tasksleads_lead(id) ON DELETE CASCADE,
                tag VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(lead_id, tag)
            );
            
            CREATE INDEX IF NOT EXISTS idx_lead_tag_lead_id ON tasksleads_lead_tag(lead_id);
            CREATE INDEX IF NOT EXISTS idx_lead_tag_text ON tasksleads_lead_tag(tag);
        `;
        await client.query(createTagsTable);
        console.log('✅ Created/verified tasksleads_lead_tag table');


        // 2. Create AI Profile Table
        // Stores advanced classification data (intent, summary, etc)
        const createAiTable = `
            CREATE TABLE IF NOT EXISTS tasksleads_lead_ai (
                lead_id INTEGER PRIMARY KEY REFERENCES tasksleads_lead(id) ON DELETE CASCADE,
                categoria_principal VARCHAR(100),
                verticales_interes JSONB DEFAULT '[]'::jsonb,
                intencion VARCHAR(100),
                urgencia VARCHAR(50), -- BAJA, MEDIA, ALTA, URGENTE
                resumen TEXT,
                confianza INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        await client.query(createAiTable);
        console.log('✅ Created/verified tasksleads_lead_ai table');

        await client.query('COMMIT');
        console.log('🎉 Phase 2 Migration completed successfully!');

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
