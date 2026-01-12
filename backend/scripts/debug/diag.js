require('dotenv').config();
const pool = require('./db');

async function run() {
    try {
        console.log('\n=== DIAGNÓSTICO DE CAJA ===\n');

        // Cajas en sucursal 2
        const cajas = await pool.query(`
            SELECT id, estado, created_at 
            FROM caja 
            WHERE id_sucursal = 2 
            ORDER BY created_at DESC 
            LIMIT 3
        `);
        console.log('Cajas en sucursal 2:');
        cajas.rows.forEach(c => console.log(`  ID ${c.id}: ${c.estado} - ${c.created_at}`));

        // Caja abierta actual
        const cajaAbierta = await pool.query(`
            SELECT id FROM caja WHERE id_sucursal = 2 AND estado = 'ABIERTA' ORDER BY created_at DESC LIMIT 1
        `);

        if (cajaAbierta.rows.length === 0) {
            console.log('\nNo hay caja abierta');
            pool.end();
            return;
        }

        const idCaja = cajaAbierta.rows[0].id;
        console.log(`\nCaja abierta: ID ${idCaja}`);

        // Movimientos
        const movs = await pool.query(`
            SELECT id, tipo, monto, origen_tipo, origen_id, created_at
            FROM cajamovimiento 
            WHERE id_caja = $1
            ORDER BY created_at DESC
        `, [idCaja]);

        console.log(`\nMovimientos (${movs.rows.length} total):`);
        let totalIngresos = 0;
        movs.rows.forEach(m => {
            console.log(`  ${m.tipo} ${m.monto}€ - ${m.origen_tipo} orden ${m.origen_id} (mov ${m.id})`);
            if (m.tipo === 'INGRESO') totalIngresos += parseFloat(m.monto);
        });

        console.log(`\nTotal Ingresos: ${totalIngresos}€`);

        // Verificar duplicados
        const dups = await pool.query(`
            SELECT origen_id, monto, COUNT(*) as cnt
            FROM cajamovimiento 
            WHERE id_caja = $1 AND origen_tipo = 'ORDEN_PAGO'
            GROUP BY origen_id, monto
            HAVING COUNT(*) > 1
        `, [idCaja]);

        if (dups.rows.length > 0) {
            console.log('\n⚠️ DUPLICADOS:');
            dups.rows.forEach(d => console.log(`  Orden ${d.origen_id}: ${d.monto}€ x${d.cnt}`));
        } else {
            console.log('\n✓ Sin duplicados');
        }

        pool.end();
    } catch (e) {
        console.error('Error:', e.message);
        pool.end();
    }
}

run();
