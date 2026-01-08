/**
 * Script para limpiar TODOS los pagos de orden 73 y empezar limpio
 * Ejecutar con: node backend/clean-orden73.js
 */
require('dotenv').config();
const pool = require('./db');

async function cleanOrden73() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Limpiando orden 73...\n');
        
        await client.query('BEGIN');
        
        // 1. Ver pagos actuales
        const pagosActuales = await client.query(`
            SELECT op.id, op.importe, mp.nombre 
            FROM ordenpago op 
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            WHERE op.id_orden = 73
        `);
        
        console.log('Pagos actuales:');
        pagosActuales.rows.forEach(p => console.log(`  - ${p.id}: ${p.importe}€ (${p.nombre})`));
        console.log(`Total: ${pagosActuales.rows.reduce((s,p) => s + parseFloat(p.importe), 0).toFixed(2)}€`);
        
        // 2. Eliminar TODOS los movimientos de caja de esta orden
        const movDeleted = await client.query(`
            DELETE FROM cajamovimiento 
            WHERE origen_tipo = 'ORDEN_PAGO' AND origen_id = 73
            RETURNING id
        `);
        console.log(`\n🗑️ Movimientos de caja eliminados: ${movDeleted.rowCount}`);
        
        // 3. Eliminar TODOS los pagos de esta orden
        const pagosDeleted = await client.query(`
            DELETE FROM ordenpago WHERE id_orden = 73
            RETURNING id
        `);
        console.log(`🗑️ Pagos eliminados: ${pagosDeleted.rowCount}`);
        
        await client.query('COMMIT');
        
        console.log('\n✅ Orden 73 limpia - sin pagos.');
        console.log('Ahora puedes agregar pagos frescos desde la interfaz.');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

cleanOrden73();
