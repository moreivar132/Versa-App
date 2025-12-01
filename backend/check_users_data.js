const pool = require('./db');

async function checkUsers() {
    try {
        console.log('Checking usuario table...');
        const res = await pool.query('SELECT id, nombre, email, id_tenant, is_super_admin FROM usuario');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error checking users:', err);
    } finally {
        await pool.end();
    }
}

checkUsers();
