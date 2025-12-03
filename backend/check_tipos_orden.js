const pool = require('./db');

async function checkTipoOrden() {
    try {
        const result = await pool.query('SELECT * FROM tipoorden ORDER BY id');
        console.log('=== TIPOS DE ORDEN EN LA BD ===');
        console.table(result.rows);

        const estadoResult = await pool.query('SELECT * FROM estadoorden ORDER BY id');
        console.log('\n=== ESTADOS DE ORDEN EN LA BD ===');
        console.table(estadoResult.rows);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTipoOrden();
