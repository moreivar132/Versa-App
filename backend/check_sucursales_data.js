const pool = require('./db');

async function checkSucursales() {
    try {
        console.log('Checking sucursales table...');
        const res = await pool.query('SELECT * FROM sucursal');
        console.log(`Found ${res.rows.length} sucursales.`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error checking sucursales:', err);
    } finally {
        await pool.end();
    }
}

checkSucursales();
