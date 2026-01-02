/**
 * Script para migrar datos existentes al Income Ledger
 * Este script recupera pagos de marketplace y ventas del CRM
 * y los registra en la tabla income_event
 */

require('dotenv').config({ path: '../.env' });
const pool = require('../db');
const incomeService = require('../services/incomeService');

async function migrateToIncomeLedger() {
    const client = await pool.connect();

    try {
        console.log('🚀 Iniciando migración al Income Ledger...\n');

        let marketplaceCount = 0;
        let crmCount = 0;

        // 1. Migrar pagos de Marketplace (status = PAID)
        console.log('📦 Migrando pagos de Marketplace...');
        const marketplacePagos = await client.query(`
            SELECT 
                mrp.id,
                mrp.id_tenant,
                mrp.id_sucursal,
                mrp.id_cita,
                mrp.id_cliente,
                mrp.amount,
                mrp.currency,
                mrp.status,
                mrp.stripe_checkout_session_id,
                mrp.created_at
            FROM marketplace_reserva_pago mrp
            WHERE mrp.status = 'PAID'
        `);

        for (const pago of marketplacePagos.rows) {
            try {
                const reference = `marketplace:cita:${pago.id_cita}:${pago.id}`;

                // Verificar si ya existe
                const existing = await incomeService.checkExistingEvent(pago.id_tenant, reference);
                if (existing) {
                    console.log(`   ⏭️  Ya existe: ${reference}`);
                    continue;
                }

                await incomeService.createIncomeEvent({
                    idTenant: pago.id_tenant,
                    idSucursal: pago.id_sucursal,
                    origen: 'marketplace',
                    originType: 'cita',
                    originId: pago.id_cita,
                    idCliente: pago.id_cliente,
                    amount: parseFloat(pago.amount),
                    currency: pago.currency.toUpperCase(),
                    status: 'paid',
                    provider: 'stripe',
                    reference,
                    description: `Pago de reserva marketplace - Cita #${pago.id_cita}`,
                    metadata: {
                        stripe_session: pago.stripe_checkout_session_id,
                        migrated_at: new Date().toISOString()
                    }
                });

                marketplaceCount++;
                console.log(`   ✅ Migrado: Pago marketplace #${pago.id} - €${pago.amount}`);

            } catch (err) {
                console.error(`   ❌ Error migrando pago marketplace #${pago.id}:`, err.message);
            }
        }

        // 2. Migrar ventas del CRM (estado = COMPLETADA)
        console.log('\n💼 Migrando ventas del CRM...');
        const ventas = await client.query(`
            SELECT 
                v.id,
                v.id_tenant,
                v.id_sucursal,
                v.id_cliente,
                v.total_neto,
                v.estado,
                v.created_at
            FROM venta v
            WHERE v.estado = 'COMPLETADA'
        `);

        for (const venta of ventas.rows) {
            try {
                const reference = `crm:venta:${venta.id}`;

                // Verificar si ya existe
                const existing = await incomeService.checkExistingEvent(venta.id_tenant, reference);
                if (existing) {
                    console.log(`   ⏭️  Ya existe: ${reference}`);
                    continue;
                }

                await incomeService.createIncomeEvent({
                    idTenant: venta.id_tenant,
                    idSucursal: venta.id_sucursal,
                    origen: 'crm',
                    originType: 'venta',
                    originId: venta.id,
                    idCliente: venta.id_cliente,
                    amount: parseFloat(venta.total_neto),
                    currency: 'EUR',
                    status: 'paid',
                    provider: 'internal',
                    reference,
                    description: `Venta CRM #${venta.id}`,
                    metadata: {
                        migrated_at: new Date().toISOString()
                    }
                });

                crmCount++;
                console.log(`   ✅ Migrado: Venta CRM #${venta.id} - €${venta.total_neto}`);

            } catch (err) {
                console.error(`   ❌ Error migrando venta #${venta.id}:`, err.message);
            }
        }

        // 3. Migrar órdenes con pagos del CRM
        console.log('\n🔧 Migrando pagos de órdenes del CRM...');
        const ordenesPagos = await client.query(`
            SELECT 
                op.id,
                op.id_orden,
                op.monto,
                op.metodo_pago,
                op.created_at,
                o.id_tenant,
                o.id_sucursal,
                o.id_cliente_final
            FROM ordenpago op
            JOIN orden o ON op.id_orden = o.id
            WHERE op.monto > 0
        `);

        let ordenesCount = 0;
        for (const pago of ordenesPagos.rows) {
            try {
                const reference = `crm:orden:${pago.id_orden}:pago:${pago.id}`;

                // Verificar si ya existe
                const existing = await incomeService.checkExistingEvent(pago.id_tenant, reference);
                if (existing) {
                    console.log(`   ⏭️  Ya existe: ${reference}`);
                    continue;
                }

                await incomeService.createIncomeEvent({
                    idTenant: pago.id_tenant,
                    idSucursal: pago.id_sucursal,
                    origen: 'crm',
                    originType: 'orden',
                    originId: pago.id_orden,
                    idCliente: pago.id_cliente_final,
                    amount: parseFloat(pago.monto),
                    currency: 'EUR',
                    status: 'paid',
                    provider: pago.metodo_pago || 'internal',
                    reference,
                    description: `Pago de orden #${pago.id_orden}`,
                    metadata: {
                        pago_id: pago.id,
                        migrated_at: new Date().toISOString()
                    }
                });

                ordenesCount++;
                console.log(`   ✅ Migrado: Pago orden #${pago.id_orden} - €${pago.monto}`);

            } catch (err) {
                console.error(`   ❌ Error migrando pago orden #${pago.id_orden}:`, err.message);
            }
        }

        // Resumen final
        console.log('\n' + '═'.repeat(50));
        console.log('📊 RESUMEN DE MIGRACIÓN');
        console.log('═'.repeat(50));
        console.log(`   Marketplace: ${marketplaceCount} pagos migrados`);
        console.log(`   Ventas CRM:  ${crmCount} ventas migradas`);
        console.log(`   Órdenes CRM: ${ordenesCount} pagos migrados`);
        console.log(`   TOTAL:       ${marketplaceCount + crmCount + ordenesCount} eventos`);
        console.log('═'.repeat(50));

        // Verificar totales
        const totals = await client.query(`
            SELECT 
                origen,
                COUNT(*) as count,
                SUM(amount) as total
            FROM income_event
            GROUP BY origen
        `);

        console.log('\n📈 Estado actual del Income Ledger:');
        totals.rows.forEach(row => {
            console.log(`   ${row.origen}: ${row.count} eventos, €${parseFloat(row.total).toFixed(2)}`);
        });

        console.log('\n✅ Migración completada exitosamente!');

    } catch (error) {
        console.error('❌ Error en migración:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migrateToIncomeLedger();
