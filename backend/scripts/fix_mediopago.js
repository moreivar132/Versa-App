
const pool = require('../db');

async function fixMedioPago() {
    console.log('--- Verifying Payment Methods ---');
    try {
        const methods = [
            { codigo: 'EFECTIVO', nombre: 'Efectivo' },
            { codigo: 'TARJETA', nombre: 'Tarjeta' },
            { codigo: 'TRANSFERENCIA', nombre: 'Transferencia' }
        ];

        for (const m of methods) {
            const res = await pool.query('SELECT * FROM mediopago WHERE codigo = $1', [m.codigo]);
            if (res.rows.length === 0) {
                console.log(`Creating missing payment method: ${m.codigo}`);
                await pool.query('INSERT INTO mediopago (nombre, codigo) VALUES ($1, $2)', [m.nombre, m.codigo]);
            } else {
                console.log(`Payment method exists: ${m.codigo}`);
            }
        }
        console.log('--- Done ---');
    } catch (error) {
        console.error('Error fixing payment methods:', error);
    } finally {
        pool.end();
    }
}

fixMedioPago();
