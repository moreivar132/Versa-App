const pool = require('./db');

async function updateSucursalTenant() {
    try {
        console.log('Updating sucursal tenant to 1...');
        await pool.query('UPDATE sucursal SET id_tenant = 1 WHERE id = 1');
        console.log('Sucursal updated.');
    } catch (err) {
        console.error('Error updating sucursal:', err);
    } finally {
        await pool.end();
    }
}

updateSucursalTenant();
