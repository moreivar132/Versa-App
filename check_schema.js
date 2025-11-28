const pool = require('./backend/db');

async function checkSchema() {
    try {
        const res = await pool.query('SELECT * FROM sucursal LIMIT 1');
        console.log('Sucursal columns:', Object.keys(res.rows[0] || {}));

        const res2 = await pool.query('SELECT * FROM usuario LIMIT 1');
        console.log('Usuario columns:', Object.keys(res2.rows[0] || {}));

        const res3 = await pool.query('SELECT * FROM usuariosucursal LIMIT 1');
        console.log('UsuarioSucursal columns:', Object.keys(res3.rows[0] || {}));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSchema();
