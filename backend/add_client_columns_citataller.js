const pool = require('./db');

async function addClientColumnsToCitaTaller() {
    try {
        console.log('Adding client columns to citataller table...');

        const queries = [
            "ALTER TABLE citataller ADD COLUMN IF NOT EXISTS nombre_cliente VARCHAR(255);",
            "ALTER TABLE citataller ADD COLUMN IF NOT EXISTS telefono_cliente VARCHAR(50);",
            "ALTER TABLE citataller ADD COLUMN IF NOT EXISTS correo_cliente VARCHAR(255);"
        ];

        for (const query of queries) {
            await pool.query(query);
            console.log(`Executed: ${query}`);
        }

        console.log('Columns added successfully.');
    } catch (error) {
        console.error('Error adding columns:', error);
    } finally {
        pool.end();
    }
}

addClientColumnsToCitaTaller();
