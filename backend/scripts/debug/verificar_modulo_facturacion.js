/**
 * Script de prueba del módulo de facturación
 * Verifica que todo esté configurado correctamente
 */

require('dotenv').config();
const pool = require('./db');

async function verificarModuloFacturacion() {
    console.log('🧪 Verificando módulo de facturación...\n');

    const client = await pool.connect();

    try {
        let todoOK = true;

        // 1. Verificar tablas
        console.log('📊 Verificando tablas...');
        const tablasRequeridas = [
            'facturaserie',
            'facturaconfigtenant',
            'facturacabecera',
            'facturalinea',
            'facturapago'
        ];

        for (const tabla of tablasRequeridas) {
            const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tabla]);

            if (result.rows[0].exists) {
                console.log(`  ✓ ${tabla}`);
            } else {
                console.log(`  ❌ ${tabla} NO EXISTE`);
                todoOK = false;
            }
        }

        // 2. Verificar columnas añadidas a orden
        console.log('\n📋 Verificando columnas en tabla orden...');
        const columnasOrden = ['requiere_factura', 'id_factura'];

        for (const columna of columnasOrden) {
            const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'orden' AND column_name = $1
        )
      `, [columna]);

            if (result.rows[0].exists) {
                console.log(`  ✓ ${columna}`);
            } else {
                console.log(`  ❌ ${columna} NO EXISTE`);
                todoOK = false;
            }
        }

        // 3. Verificar series por defecto
        console.log('\n🔢 Verificando series por defecto...');
        const seriesResult = await client.query(`
      SELECT s.nombre as sucursal, fs.nombre_serie, fs.prefijo
      FROM facturaserie fs
      INNER JOIN sucursal s ON fs.id_sucursal = s.id
      WHERE fs.es_por_defecto = true
      ORDER BY s.id
    `);

        if (seriesResult.rows.length > 0) {
            seriesResult.rows.forEach(serie => {
                console.log(`  ✓ ${serie.sucursal}: Serie "${serie.nombre_serie}" (Prefijo: "${serie.prefijo}")`);
            });
        } else {
            console.log('  ⚠️  No hay series por defecto configuradas');
            console.log('  💡 Ejecuta: node configurar_facturacion_defaults.js');
            todoOK = false;
        }

        // 4. Verificar configuración de tenants
        console.log('\n🎨 Verificando configuración de tenants...');
        const configResult = await client.query(`
      SELECT t.nombre as tenant, fc.color_primario
      FROM facturaconfigtenant fc
      INNER JOIN tenant t ON fc.id_tenant = t.id
      WHERE fc.es_por_defecto = true
      ORDER BY t.id
    `);

        if (configResult.rows.length > 0) {
            configResult.rows.forEach(config => {
                console.log(`  ✓ ${config.tenant}: Color ${config.color_primario}`);
            });
        } else {
            console.log('  ⚠️  No hay configuraciones por defecto');
            console.log('  💡 Ejecuta: node configurar_facturacion_defaults.js');
            todoOK = false;
        }

        // 5. Verificar índices importantes
        console.log('\n🔍 Verificando índices...');
        const indices = [
            'ux_facturaserie_default',
            'ux_facturacabecera_serie_correlativo',
            'ux_factura_por_orden'
        ];

        for (const indice of indices) {
            const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = $1
        )
      `, [indice]);

            if (result.rows[0].exists) {
                console.log(`  ✓ ${indice}`);
            } else {
                console.log(`  ⚠️  ${indice} no encontrado`);
            }
        }

        // 6. Verificar órdenes que requieren factura
        console.log('\n📝 Verificando órdenes pendientes de facturar...');
        const ordenesResult = await client.query(`
      SELECT COUNT(*) as total
      FROM orden
      WHERE requiere_factura = true AND id_factura IS NULL
    `);

        console.log(`  📊 Órdenes pendientes: ${ordenesResult.rows[0].total}`);

        // 7. Verificar facturas emitidas
        console.log('\n💳 Verificando facturas emitidas...');
        const facturasResult = await client.query(`
      SELECT COUNT(*) as total, estado
      FROM facturacabecera
      GROUP BY estado
      ORDER BY estado
    `);

        if (facturasResult.rows.length > 0) {
            facturasResult.rows.forEach(row => {
                console.log(`  📄 ${row.estado}: ${row.total} facturas`);
            });
        } else {
            console.log(`  📊 No hay facturas emitidas aún`);
        }

        // Resumen final
        console.log('\n' + '='.repeat(60));
        if (todoOK) {
            console.log('✅ MÓDULO DE FACTURACIÓN OPERATIVO');
            console.log('\n🚀 El módulo está listo para usar!');
            console.log('\n📚 Consulta MODULO_FACTURACION.md para más información');
        } else {
            console.log('⚠️  HAY ELEMENTOS FALTANTES');
            console.log('\n💡 Ejecuta los scripts de configuración necesarios');
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error durante la verificación:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verificarModuloFacturacion();
