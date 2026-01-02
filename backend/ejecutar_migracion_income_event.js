/**
 * Script para ejecutar la migración de income_event
 * Ejecutar: node ejecutar_migracion_income_event.js
 */
const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Iniciando migración de income_event...\n');

        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'migrations', 'create_income_event_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Ejecutar la migración
        await client.query(sql);
        console.log('✅ Tabla income_event creada');
        console.log('✅ Columnas de feature gating añadidas a plan_suscripcion');
        console.log('✅ Planes actualizados con features');
        console.log('✅ Vista v_income_summary creada');

        // Verificar la estructura
        const tableCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'income_event'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Estructura de income_event:');
        console.table(tableCheck.rows.map(r => ({
            Columna: r.column_name,
            Tipo: r.data_type,
            Nullable: r.is_nullable
        })));

        // Verificar planes
        const planesCheck = await client.query(`
            SELECT nombre, incluye_marketplace, incluye_crm, features_json
            FROM plan_suscripcion
            ORDER BY id
        `);

        console.log('\n📋 Planes de suscripción actualizados:');
        console.table(planesCheck.rows.map(p => ({
            Plan: p.nombre,
            Marketplace: p.incluye_marketplace ? '✓' : '✗',
            CRM: p.incluye_crm ? '✓' : '✗',
            Features: JSON.stringify(p.features_json)
        })));

        console.log('\n✨ Migración completada con éxito!');

    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
