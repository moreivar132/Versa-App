const pool = require('./db');

async function checkSucursalSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sucursal'
        `);
        console.log('Columns:', res.rows);

        const data = await pool.query('SELECT * FROM sucursal LIMIT 1');
        console.log('Data:', data.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSucursalSchema();
