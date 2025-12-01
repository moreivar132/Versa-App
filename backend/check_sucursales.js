const pool = require('./db');

async function checkSucursales() {
    try {
        const res = await pool.query('SELECT * FROM sucursal');
        console.log('Sucursales:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSucursales();
