/**
 * Script para configurar series y configuración por defecto
 * Ejecutar después de la migración
 */

require('dotenv').config();
const pool = require('./db');

async function configurarDefaults() {
    console.log('🔧 Configurando series y configuración por defecto...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Crear una serie por defecto para cada sucursal
        console.log('📊 Creando series de facturación por defecto...');

        const sucursalesResult = await client.query('SELECT id, nombre FROM sucursal ORDER BY id');

        for (const sucursal of sucursalesResult.rows) {
            // Verificar si ya existe una serie por defecto
            const existeResult = await client.query(
                'SELECT id FROM facturaserie WHERE id_sucursal = $1 AND es_por_defecto = true LIMIT 1',
                [sucursal.id]
            );

            if (existeResult.rows.length === 0) {
                await client.query(`
          INSERT INTO facturaserie (
            id_sucursal,
            nombre_serie,
            prefijo,
            tipo_documento,
            activo,
            es_por_defecto
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                    sucursal.id,
                    'A',
                    'F',
                    'FACTURA',
                    true,
                    true
                ]);
                console.log(`  ✓ Serie creada para sucursal: ${sucursal.nombre} (ID: ${sucursal.id})`);
            } else {
                console.log(`  - Serie ya existe para sucursal: ${sucursal.nombre} (ID: ${sucursal.id})`);
            }
        }

        // 2. Crear configuración por defecto para cada tenant
        console.log('\n🎨 Creando configuración de facturas por defecto...');

        const tenantsResult = await client.query('SELECT id, nombre FROM tenant ORDER BY id');

        for (const tenant of tenantsResult.rows) {
            // Verificar si ya existe configuración por defecto
            const existeConfigResult = await client.query(
                'SELECT id FROM facturaconfigtenant WHERE id_tenant = $1 AND es_por_defecto = true LIMIT 1',
                [tenant.id]
            );

            if (existeConfigResult.rows.length === 0) {
                await client.query(`
          INSERT INTO facturaconfigtenant (
            id_tenant,
            nombre_plantilla,
            color_primario,
            cabecera_html,
            pie_html,
            texto_legal,
            mostrar_columna_iva,
            mostrar_columna_descuento,
            mostrar_domicilio_cliente,
            mostrar_matricula_vehiculo,
            es_por_defecto
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
                    tenant.id,
                    'Por defecto',
                    '#ff4400',
                    `<div><strong>${tenant.nombre || 'Taller'}</strong></div>`,
                    '<p style="text-align: center;">Gracias por confiar en nuestro taller</p>',
                    'Factura sujeta al Régimen General del IVA. Servicio prestado y facturado correctamente.',
                    true,
                    true,
                    true,
                    true,
                    true
                ]);
                console.log(`  ✓ Configuración creada para tenant: ${tenant.nombre} (ID: ${tenant.id})`);
            } else {
                console.log(`  - Configuración ya existe para tenant: ${tenant.nombre} (ID: ${tenant.id})`);
            }
        }

        await client.query('COMMIT');

        console.log('\n✅ Configuración completada!');
        console.log('\n📋 Resumen:');
        console.log(`  - Sucursales configuradas: ${sucursalesResult.rows.length}`);
        console.log(`  - Tenants configurados: ${tenantsResult.rows.length}`);
        console.log('\n🎯 El módulo de facturación está listo para usar!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error al configurar defaults:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

configurarDefaults();
