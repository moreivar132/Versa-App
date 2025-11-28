require('dotenv').config();
const pool = require('./db');

async function checkSchema() {
    try {
        // Check tables
        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name IN ('usuariopermiso', 'usuario');
        `);
        console.log('Tables found:', tablesRes.rows.map(r => r.table_name));

        // Check columns in usuario
        const columnsRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuario' AND column_name = 'porcentaje_mano_obra';
        `);
        console.log('Columns found in usuario:', columnsRes.rows.map(r => r.column_name));

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSchema();
