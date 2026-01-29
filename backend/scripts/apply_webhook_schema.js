require('dotenv').config(); // Load .env from backend root
const knex = require('knex')({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: { rejectUnauthorized: false }
    }
});

async function run() {
    try {
        console.log('🔄 Checking Schema (from backend context)...');

        // 1. Check tasksleads_webhook_event
        const tableExists = await knex.schema.hasTable('tasksleads_webhook_event');
        if (!tableExists) {
            console.log('Creating tasksleads_webhook_event table...');
            await knex.raw(`
            CREATE TABLE IF NOT EXISTS tasksleads_webhook_event (
                id SERIAL PRIMARY KEY,
                id_tenant INTEGER, -- Can be null initially
                external_event_id VARCHAR(255) UNIQUE NOT NULL,
                event_type VARCHAR(100),
                payload JSONB,
                processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_tasksleads_webhook_event_external ON tasksleads_webhook_event(external_event_id);
        `);
        } else {
            console.log('✅ Table tasksleads_webhook_event already exists');
        }

        // 2. Check last_message_preview column in tasksleads_lead
        const hasCol = await knex.schema.hasColumn('tasksleads_lead', 'last_message_preview');
        if (!hasCol) {
            console.log('Adding last_message_preview to tasksleads_lead...');
            await knex.schema.table('tasksleads_lead', t => {
                t.text('last_message_preview');
            });
        } else {
            console.log('✅ Column last_message_preview already exists');
        }

        console.log('✅ Schema check complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error applying schema:', err);
        process.exit(1);
    }
}

run();
