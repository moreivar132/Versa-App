/**
 * Script para ejecutar las migraciones del Marketplace
 * Ejecutar con: node ejecutar_migracion_marketplace.js
 * 
 * Este script:
 * 1. Crea las tablas del marketplace
 * 2. Puebla el catálogo de servicios
 * 3. Verifica la instalación
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function ejecutarMigracion() {
    console.log('🏪 Iniciando migración del Marketplace...\n');

    const client = await pool.connect();

    try {
        // =============================================
        // PASO 1: Crear tablas
        // =============================================
        const sqlFile = path.join(__dirname, 'migrations', 'create_marketplace_tables.sql');
        const sql = fs.readFileSync(sqlFile, 'utf-8');

        console.log('📄 Ejecutando SQL desde:', sqlFile);
        console.log('='.repeat(80));

        await client.query(sql);

        console.log('\n✅ Tablas del Marketplace creadas correctamente!');
        console.log('\nTablas creadas:');
        console.log('  - marketplace_listing (perfiles públicos de sucursales)');
        console.log('  - marketplace_servicio (catálogo global de servicios)');
        console.log('  - marketplace_servicio_sucursal (servicios por sucursal con precios)');
        console.log('  - marketplace_promo (promociones y ofertas)');
        console.log('  - marketplace_review (reseñas verificadas)');

        // =============================================
        // PASO 2: Poblar servicios
        // =============================================
        console.log('\n📦 Poblando catálogo de servicios...');
        const seedFile = path.join(__dirname, 'migrations', 'populate_marketplace_servicios.sql');
        const seedSql = fs.readFileSync(seedFile, 'utf-8');

        await client.query(seedSql);

        // Contar servicios creados
        const countResult = await client.query(`
            SELECT COUNT(*) as total FROM marketplace_servicio WHERE activo = true
        `);
        const totalServicios = countResult.rows[0].total;

        console.log(`✅ ${totalServicios} servicios agregados al catálogo`);

        // =============================================
        // PASO 3: Verificar instalación
        // =============================================
        console.log('\n📊 Verificando instalación...\n');

        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'marketplace_%'
            ORDER BY table_name;
        `);

        console.log('Tablas del Marketplace en la base de datos:');
        result.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });

        // Verificar índices
        const indexResult = await client.query(`
            SELECT 
                schemaname,
                tablename,
                indexname
            FROM pg_indexes
            WHERE tablename LIKE 'marketplace_%'
            AND schemaname = 'public'
            ORDER BY tablename, indexname;
        `);

        console.log(`\n📑 ${indexResult.rows.length} índices creados para optimización de búsquedas`);

        // Verificar triggers
        const triggerResult = await client.query(`
            SELECT 
                trigger_name,
                event_object_table
            FROM information_schema.triggers
            WHERE trigger_name LIKE '%marketplace%'
            ORDER BY event_object_table, trigger_name;
        `);

        console.log(`\n⚡ ${triggerResult.rows.length} triggers activos (updated_at automation)`);

        // Mostrar ejemplo de uso
        console.log('\n' + '='.repeat(80));
        console.log('🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO!');
        console.log('='.repeat(80));
        console.log('\n📝 Próximos pasos:');
        console.log('   1. Activar marketplace para una sucursal:');
        console.log('      INSERT INTO marketplace_listing (id_tenant, id_sucursal, activo, descripcion_publica)');
        console.log('      VALUES (1, 1, true, \'Tu descripción aquí\');');
        console.log('');
        console.log('   2. Agregar servicios a la sucursal:');
        console.log('      INSERT INTO marketplace_servicio_sucursal');
        console.log('      (id_tenant, id_sucursal, id_servicio, precio, duracion_min)');
        console.log('      VALUES (1, 1, 1, 45.00, 30);');
        console.log('');
        console.log('   3. Crear una promoción:');
        console.log('      INSERT INTO marketplace_promo');
        console.log('      (id_tenant, id_sucursal, titulo, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin)');
        console.log('      VALUES (1, 1, \'20% descuento\', \'PORCENTAJE\', 20, CURRENT_DATE, CURRENT_DATE + 30);');
        console.log('\n📚 Ver MODULO_MARKETPLACE.md para más información');
        console.log('');

    } catch (error) {
        console.error('\n❌ Error al ejecutar la migración:');
        console.error(error);
        console.error('\n💡 Sugerencias:');
        console.error('   - Verifica que las tablas tenant, sucursal, clientefinal, citataller y orden existan');
        console.error('   - Comprueba que la conexión a PostgreSQL sea correcta');
        console.error('   - Revisa los logs de errores arriba para más detalles');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar migración
ejecutarMigracion();
