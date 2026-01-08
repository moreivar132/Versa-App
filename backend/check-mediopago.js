const pool = require('./db');

async function checkMediosPago() {
    try {
        const result = await pool.query('SELECT id, codigo, nombre FROM mediopago ORDER BY id');
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        pool.end();
    }
}

checkMediosPago();
