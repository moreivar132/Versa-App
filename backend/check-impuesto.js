const pool = require('./db');

async function checkImpuestoTable() {
    try {
        // Ver estructura de la tabla
        const cols = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'impuesto'
        `);
        console.log('Columnas de impuesto:', cols.rows);

        // Ver datos existentes
        const data = await pool.query('SELECT * FROM impuesto');
        console.log('Datos existentes:', data.rows);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        pool.end();
    }
}

checkImpuestoTable();
