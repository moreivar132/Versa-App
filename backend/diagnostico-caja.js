/**
 * Diagnóstico exhaustivo de caja CJ-VT-006
 * Ejecutar con: node backend/diagnostico-caja.js
 */
require('dotenv').config();
const pool = require('./db');

async function diagnosticoCaja() {
    const client = await pool.connect();

    try {
        console.log('🔍 DIAGNÓSTICO EXHAUSTIVO DE CAJA\n');
        console.log('='.repeat(60));

        // 1. Encontrar la caja CJ-VT-006 o la caja abierta de sucursal 2
        const cajaResult = await client.query(`
            SELECT c.id, c.nombre, c.estado, c.id_sucursal, c.saldo_apertura, c.created_at,
                   s.nombre as sucursal_nombre
            FROM caja c
            JOIN sucursal s ON c.id_sucursal = s.id
            WHERE c.id_sucursal = 2 AND c.estado = 'ABIERTA'
            ORDER BY c.created_at DESC
            LIMIT 1
        `);

        if (cajaResult.rows.length === 0) {
            console.log('❌ No hay caja abierta en sucursal 2');
            return;
        }

        const caja = cajaResult.rows[0];
        console.log(`📦 CAJA: ${caja.nombre || 'Sin nombre'} (ID: ${caja.id})`);
        console.log(`   Sucursal: ${caja.sucursal_nombre}`);
        console.log(`   Estado: ${caja.estado}`);
        console.log(`   Saldo Apertura: ${caja.saldo_apertura}€`);
        console.log(`   Fecha: ${caja.created_at}`);

        // 2. Obtener TODOS los movimientos de esta caja
        console.log('\n' + '='.repeat(60));
        console.log('📋 TODOS LOS MOVIMIENTOS DE CAJA:\n');

        const movimientos = await client.query(`
            SELECT 
                cm.id,
                cm.tipo,
                cm.monto,
                cm.origen_tipo,
                cm.origen_id,
                cm.concepto,
                cm.fecha,
                cm.created_at
            FROM cajamovimiento cm
            WHERE cm.id_caja = $1
            ORDER BY cm.created_at DESC
        `, [caja.id]);

        let totalIngresos = 0;
        let totalEgresos = 0;

        movimientos.rows.forEach((m, i) => {
            const signo = m.tipo === 'INGRESO' ? '+' : '-';
            console.log(`${i + 1}. [${m.tipo}] ${signo}${m.monto}€`);
            console.log(`   Origen: ${m.origen_tipo} - ID: ${m.origen_id}`);
            console.log(`   Concepto: ${m.concepto || '(sin concepto)'}`);
            console.log(`   Fecha: ${m.created_at}`);
            console.log('');

            if (m.tipo === 'INGRESO') totalIngresos += parseFloat(m.monto);
            else totalEgresos += parseFloat(m.monto);
        });

        console.log('='.repeat(60));
        console.log(`💰 RESUMEN:`);
        console.log(`   Total Movimientos: ${movimientos.rows.length}`);
        console.log(`   Ingresos: +${totalIngresos.toFixed(2)}€`);
        console.log(`   Egresos: -${totalEgresos.toFixed(2)}€`);
        console.log(`   Resultado: ${(totalIngresos - totalEgresos).toFixed(2)}€`);

        // 3. Verificar movimientos por origen
        console.log('\n' + '='.repeat(60));
        console.log('📊 MOVIMIENTOS POR ORIGEN:\n');

        const porOrigen = await client.query(`
            SELECT 
                origen_tipo,
                COUNT(*) as cantidad,
                SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END) as ingresos,
                SUM(CASE WHEN tipo = 'EGRESO' THEN monto ELSE 0 END) as egresos
            FROM cajamovimiento
            WHERE id_caja = $1
            GROUP BY origen_tipo
        `, [caja.id]);

        porOrigen.rows.forEach(o => {
            console.log(`${o.origen_tipo || 'SIN_ORIGEN'}:`);
            console.log(`   Cantidad: ${o.cantidad}`);
            console.log(`   Ingresos: ${parseFloat(o.ingresos || 0).toFixed(2)}€`);
            console.log(`   Egresos: ${parseFloat(o.egresos || 0).toFixed(2)}€`);
        });

        // 4. Verificar si hay duplicados
        console.log('\n' + '='.repeat(60));
        console.log('🔎 VERIFICANDO DUPLICADOS:\n');

        const duplicados = await client.query(`
            SELECT origen_tipo, origen_id, monto, COUNT(*) as veces
            FROM cajamovimiento
            WHERE id_caja = $1 AND origen_tipo = 'ORDEN_PAGO'
            GROUP BY origen_tipo, origen_id, monto
            HAVING COUNT(*) > 1
        `, [caja.id]);

        if (duplicados.rows.length > 0) {
            console.log('⚠️ DUPLICADOS ENCONTRADOS:');
            duplicados.rows.forEach(d => {
                console.log(`   Orden ${d.origen_id}: ${d.monto}€ (${d.veces} veces)`);
            });
        } else {
            console.log('✓ No se encontraron movimientos duplicados');
        }

        // 5. Cruzar con ordenpago
        console.log('\n' + '='.repeat(60));
        console.log('🔗 CRUCE CON ORDENPAGO:\n');

        const ordenesConPago = await client.query(`
            SELECT 
                op.id_orden,
                o.total_neto,
                SUM(op.importe) as total_pagado,
                COUNT(op.id) as cantidad_pagos
            FROM ordenpago op
            JOIN orden o ON op.id_orden = o.id
            WHERE o.id_sucursal = 2
            GROUP BY op.id_orden, o.total_neto
            ORDER BY op.id_orden DESC
            LIMIT 10
        `);

        console.log('Últimas 10 órdenes con pagos en sucursal 2:');
        ordenesConPago.rows.forEach(o => {
            const status = parseFloat(o.total_pagado) > parseFloat(o.total_neto) ? '⚠️' : '✓';
            console.log(`${status} Orden #${o.id_orden}: ${o.total_pagado}€ de ${o.total_neto}€ (${o.cantidad_pagos} pagos)`);
        });

        // 6. Ver movimientos específicos de ORDEN_PAGO
        console.log('\n' + '='.repeat(60));
        console.log('📝 MOVIMIENTOS DE CAJA POR ORDEN_PAGO:\n');

        const movOrden = await client.query(`
            SELECT cm.id, cm.origen_id as orden_id, cm.monto, cm.tipo, cm.created_at
            FROM cajamovimiento cm
            WHERE cm.id_caja = $1 AND cm.origen_tipo = 'ORDEN_PAGO'
            ORDER BY cm.created_at DESC
        `, [caja.id]);

        movOrden.rows.forEach(m => {
            console.log(`Orden #${m.orden_id}: ${m.tipo === 'INGRESO' ? '+' : '-'}${m.monto}€ (mov. ${m.id})`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ Diagnóstico completado');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

diagnosticoCaja();
