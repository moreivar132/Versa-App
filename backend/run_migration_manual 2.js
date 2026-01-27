const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    const migrationFile = path.join(__dirname, 'migrations', '20260121_add_empresa_to_config.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Running migration: 20260121_add_empresa_to_config.sql');

    try {
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        if (err.code === '42701') { // duplicate_column
            console.log('Column already exists, skipping.');
        } else if (err.code === '42P07') { // duplicate_table/relation
            console.log('Index already exists, skipping.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await pool.end();
    }
}

runMigration();
