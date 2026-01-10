/**
 * Script para limpiar datos corruptos de órdenes 72 y 73
 * Ejecutar con: node backend/fix-ordenes-pagos.js
 */
require('dotenv').config();
const pool = require('./db');

async function fixOrdenesPagos() {
    const client = await pool.connect();

    try {
        console.log('🔧 Iniciando limpieza de datos...\n');

        await client.query('BEGIN');

        // Órdenes a limpiar
        const ordenes = [
            { id: 72, totalCorrecto: 606.21 },
            { id: 73, totalCorrecto: 202.07 }
        ];

        for (const orden of ordenes) {
            console.log(`\n📋 Procesando Orden #${orden.id} (Total: ${orden.totalCorrecto}€)`);

            // 1. Ver pagos actuales
            const pagosActuales = await client.query(`
                SELECT op.id, op.importe, mp.codigo, mp.nombre 
                FROM ordenpago op 
                JOIN mediopago mp ON op.id_medio_pago = mp.id
                WHERE op.id_orden = $1
                ORDER BY op.created_at
            `, [orden.id]);

            console.log(`   Pagos encontrados: ${pagosActuales.rows.length}`);
            pagosActuales.rows.forEach((p, i) => {
                console.log(`   - Pago #${p.id}: ${p.importe}€ (${p.nombre})`);
            });

            const totalPagado = pagosActuales.rows.reduce((sum, p) => sum + parseFloat(p.importe), 0);
            console.log(`   Total pagado: ${totalPagado.toFixed(2)}€`);

            if (totalPagado > orden.totalCorrecto) {
                console.log(`   ⚠️ Sobrepago detectado: ${(totalPagado - orden.totalCorrecto).toFixed(2)}€ de más`);

                // Calcular cuánto eliminar
                let sobrante = totalPagado - orden.totalCorrecto;

                // Eliminar pagos del final hasta compensar el sobrante
                const pagosToDelete = [];
                for (let i = pagosActuales.rows.length - 1; i >= 0 && sobrante > 0; i--) {
                    const pago = pagosActuales.rows[i];
                    if (parseFloat(pago.importe) <= sobrante + 0.01) {
                        pagosToDelete.push(pago.id);
                        sobrante -= parseFloat(pago.importe);
                    }
                }

                if (pagosToDelete.length > 0) {
                    console.log(`   🗑️ Eliminando ${pagosToDelete.length} pagos: ${pagosToDelete.join(', ')}`);

                    // Eliminar movimientos de caja asociados
                    await client.query(`
                        DELETE FROM cajamovimiento 
                        WHERE origen_tipo = 'ORDEN_PAGO' AND origen_id = $1
                    `, [orden.id]);

                    // Eliminar pagos
                    for (const pagoId of pagosToDelete) {
                        await client.query('DELETE FROM ordenpago WHERE id = $1', [pagoId]);
                    }
                }
            }

            // 2. Recrear movimientos de caja para pagos restantes
            const pagosRestantes = await client.query(`
                SELECT op.id, op.importe, op.id_caja, mp.codigo
                FROM ordenpago op
                JOIN mediopago mp ON op.id_medio_pago = mp.id
                WHERE op.id_orden = $1
            `, [orden.id]);

            console.log(`   📦 Pagos restantes: ${pagosRestantes.rows.length}`);

            // Obtener caja de la sucursal de la orden
            const ordenInfo = await client.query(`
                SELECT id_sucursal FROM orden WHERE id = $1
            `, [orden.id]);

            if (ordenInfo.rows[0]) {
                const idSucursal = ordenInfo.rows[0].id_sucursal;

                // Obtener caja abierta
                const cajaResult = await client.query(`
                    SELECT id FROM caja 
                    WHERE id_sucursal = $1 AND estado = 'ABIERTA'
                    ORDER BY created_at DESC LIMIT 1
                `, [idSucursal]);

                if (cajaResult.rows[0]) {
                    const idCaja = cajaResult.rows[0].id;

                    // Verificar y crear movimientos de caja
                    for (const pago of pagosRestantes.rows) {
                        const codigo = (pago.codigo || '').toUpperCase();
                        if (codigo !== 'CUENTA_CORRIENTE') {
                            // Verificar si ya existe movimiento
                            const existeMovimiento = await client.query(`
                                SELECT id FROM cajamovimiento 
                                WHERE origen_tipo = 'ORDEN_PAGO' 
                                  AND origen_id = $1 
                                  AND monto = $2
                            `, [orden.id, pago.importe]);

                            if (existeMovimiento.rows.length === 0) {
                                console.log(`   ➕ Creando movimiento de caja: ${pago.importe}€`);
                                await client.query(`
                                    INSERT INTO cajamovimiento 
                                    (id_caja, id_usuario, tipo, monto, origen_tipo, origen_id, fecha, created_at, created_by)
                                    VALUES ($1, 2, 'INGRESO', $2, 'ORDEN_PAGO', $3, NOW(), NOW(), 2)
                                `, [idCaja, pago.importe, orden.id]);
                            } else {
                                console.log(`   ✓ Movimiento ya existe para ${pago.importe}€`);
                            }
                        }
                    }
                }
            }

            // 3. Mostrar resumen final
            const totalFinal = await client.query(`
                SELECT COALESCE(SUM(importe), 0) as total FROM ordenpago WHERE id_orden = $1
            `, [orden.id]);

            console.log(`   ✅ Total pagado final: ${parseFloat(totalFinal.rows[0].total).toFixed(2)}€`);
        }

        await client.query('COMMIT');
        console.log('\n✅ Limpieza completada exitosamente!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

fixOrdenesPagos();
