const pool = require('./db');

async function addTenantColumn() {
    const client = await pool.connect();
    try {
        console.log('Adding id_tenant column to compracabecera...');

        // Add column if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compracabecera' AND column_name='id_tenant') THEN 
                    ALTER TABLE compracabecera ADD COLUMN id_tenant INTEGER;
                END IF;
            END $$;
        `);

        // Update existing records to have id_tenant = 1 (default for now)
        await client.query('UPDATE compracabecera SET id_tenant = 1 WHERE id_tenant IS NULL');

        // Add NOT NULL constraint after populating
        await client.query('ALTER TABLE compracabecera ALTER COLUMN id_tenant SET NOT NULL');

        console.log('Column id_tenant added successfully.');
    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

addTenantColumn();
