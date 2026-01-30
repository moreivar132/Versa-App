/**
 * Migration: Fix Tasks & Leads Constraints
 * Adds missing UNIQUE constraints and columns required by webhooks
 * 
 * Run manually with: node backend/migrations/run_tasksleads_fix_constraints.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🔄 Starting Tasks & Leads Constraints Fix Migration...');

        await client.query('BEGIN');

        // 1. Add UNIQUE constraint on timeline_external_id (for ON CONFLICT)
        console.log('1️⃣ Adding UNIQUE constraint on timeline_external_id...');
        await client.query(`
            -- Drop the existing non-unique index if it exists
            DROP INDEX IF EXISTS idx_tasksleads_timeline_link_external;
            
            -- Create a UNIQUE index instead
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tasksleads_timeline_link_external_unique 
            ON tasksleads_lead_timeline_link(timeline_external_id);
        `);
        console.log('✅ UNIQUE constraint on timeline_external_id added');

        // 2. Add source column to tasksleads_lead if missing
        console.log('2️⃣ Adding source column to tasksleads_lead...');
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'tasksleads_lead' AND column_name = 'source'
                ) THEN
                    ALTER TABLE tasksleads_lead ADD COLUMN source VARCHAR(50);
                END IF;
            END $$;
        `);
        console.log('✅ source column ready');

        // 3. Add last_message_preview column to tasksleads_lead if missing
        console.log('3️⃣ Adding last_message_preview column to tasksleads_lead...');
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'tasksleads_lead' AND column_name = 'last_message_preview'
                ) THEN
                    ALTER TABLE tasksleads_lead ADD COLUMN last_message_preview TEXT;
                END IF;
            END $$;
        `);
        console.log('✅ last_message_preview column ready');

        // 4. Add id_tenant column to tasksleads_lead_tag if missing
        console.log('4️⃣ Adding id_tenant to tasksleads_lead_tag...');
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'tasksleads_lead_tag' AND column_name = 'id_tenant'
                ) THEN
                    ALTER TABLE tasksleads_lead_tag ADD COLUMN id_tenant INTEGER REFERENCES tenant(id) ON DELETE CASCADE;
                END IF;
            END $$;
        `);
        console.log('✅ id_tenant column on tasksleads_lead_tag ready');

        // 5. Add id_tenant column to tasksleads_lead_ai if missing
        console.log('5️⃣ Adding id_tenant to tasksleads_lead_ai...');
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'tasksleads_lead_ai' AND column_name = 'id_tenant'
                ) THEN
                    ALTER TABLE tasksleads_lead_ai ADD COLUMN id_tenant INTEGER REFERENCES tenant(id) ON DELETE CASCADE;
                END IF;
            END $$;
        `);
        console.log('✅ id_tenant column on tasksleads_lead_ai ready');

        // 6. Add last_analysis_at column to tasksleads_lead_ai if missing
        console.log('6️⃣ Adding last_analysis_at to tasksleads_lead_ai...');
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'tasksleads_lead_ai' AND column_name = 'last_analysis_at'
                ) THEN
                    ALTER TABLE tasksleads_lead_ai ADD COLUMN last_analysis_at TIMESTAMP;
                END IF;
            END $$;
        `);
        console.log('✅ last_analysis_at column ready');

        await client.query('COMMIT');
        console.log('🎉 Constraints Fix Migration completed successfully!');

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
