/**
 * Migration Runner: Contabilidad V3
 * Ejecuta la migración de tablas para el módulo de contabilidad
 * 
 * Uso: node migrations/run_contabilidad_v3_migration.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Iniciando migración Contabilidad V3...\n');

    const client = await pool.connect();

    try {
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'create_contabilidad_v3.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Archivo SQL cargado');
        console.log('📊 Ejecutando migración...\n');

        await client.query('BEGIN');

        // Ejecutar el SQL completo
        await client.query(sql);

        await client.query('COMMIT');

        console.log('✅ Migración completada exitosamente!\n');

        // Verificar tablas creadas
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'contabilidad_%'
            ORDER BY table_name
        `);

        console.log('📋 Tablas creadas:');
        tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        // Verificar permisos insertados
        const permsResult = await client.query(`
            SELECT key, descripcion 
            FROM permiso 
            WHERE module = 'contabilidad'
        `);

        console.log('\n🔐 Permisos insertados:');
        permsResult.rows.forEach(row => {
            console.log(`   - ${row.key}: ${row.descripcion}`);
        });

        // Verificar categorías
        const catsResult = await client.query(`
            SELECT COUNT(*) as count, tipo 
            FROM contable_category 
            GROUP BY tipo
        `);

        console.log('\n📁 Categorías contables:');
        catsResult.rows.forEach(row => {
            console.log(`   - ${row.tipo}: ${row.count} categorías`);
        });

        console.log('\n✨ Migración verificada correctamente!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
