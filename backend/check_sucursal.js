const pool = require('./db');

async function checkAndListSucursales() {
    try {
        console.log('Checking sucursal table...');

        // Check columns
        const columnsRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sucursal';
        `);
        console.log('Columns:', columnsRes.rows.map(r => r.column_name));

        // List rows
        // We try to select direccion_iframe if it exists, otherwise we skip it to avoid error
        const hasIframeCol = columnsRes.rows.some(r => r.column_name === 'direccion_iframe');

        let query = 'SELECT id, nombre, direccion FROM sucursal';
        if (hasIframeCol) {
            query = 'SELECT id, nombre, direccion, direccion_iframe FROM sucursal';
        }

        const rowsRes = await pool.query(query);
        console.log('Rows:', rowsRes.rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
}

checkAndListSucursales();
