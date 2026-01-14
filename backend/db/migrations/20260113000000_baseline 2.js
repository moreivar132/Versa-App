/**
 * MIGRACIÓN BASELINE - Estado Inicial del Schema
 * 
 * Esta migración representa el estado del schema ANTES de adoptar Knex.
 * NO ejecuta cambios reales - solo marca el punto de partida.
 * 
 * Todas las tablas que existían antes de 2026-01-13 se consideran "baseline".
 * Las migraciones futuras (después de esta) sí ejecutan cambios reales.
 * 
 * IMPORTANTE: Si estás configurando una DB desde cero, ejecuta primero
 * los scripts de legacy/sql-migrations/ en orden cronológico.
 * 
 * @see docs/MIGRATIONS.md para más información
 */

exports.up = async function (knex) {
    console.log('📋 BASELINE: Verificando estado del schema...');

    // Verificar que las tablas core existen
    const coreTables = [
        'tenant',
        'usuario',
        'sucursal',
        'clientefinal',
        'producto',
        'orden',
        'caja'
    ];

    for (const table of coreTables) {
        const exists = await knex.schema.hasTable(table);
        if (!exists) {
            console.warn(`⚠️  Tabla '${table}' no existe. ¿Es una DB nueva?`);
            console.warn(`    Ejecuta los scripts de legacy/sql-migrations/ primero.`);
        }
    }

    console.log('✅ BASELINE completado. Las migraciones futuras partirán de aquí.');

    // No ejecutamos ningún cambio real - esto es solo un marcador
    return Promise.resolve();
};

exports.down = async function (knex) {
    // El baseline no se puede revertir
    console.log('⚠️  La migración baseline no se puede revertir.');
    console.log('    Si necesitas recrear la DB, usa los scripts de legacy/sql-migrations/');
    return Promise.resolve();
};
