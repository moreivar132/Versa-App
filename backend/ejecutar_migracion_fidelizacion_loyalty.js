/**
 * Script para ejecutar la migración del módulo de Fidelización
 * Ejecutar con: node ejecutar_migracion_fidelizacion_loyalty.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
    console.log('🚀 Iniciando migración de Fidelización...\n');

    try {
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'migrations', 'create_fidelizacion_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Archivo SQL cargado correctamente');
        console.log('📊 Ejecutando migración...\n');

        // Ejecutar la migración
        await pool.query(sql);

        console.log('✅ Migración de Fidelización completada exitosamente!\n');

        // Verificar las tablas creadas
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'fidelizacion_%'
            ORDER BY table_name
        `);

        console.log('📋 Tablas creadas:');
        tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        // Verificar la vista
        const viewResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'vw_fidelizacion_saldo'
        `);

        if (viewResult.rows.length > 0) {
            console.log('\n📊 Vista creada:');
            console.log('   - vw_fidelizacion_saldo');
        }

        console.log('\n✨ Todo listo! El módulo de Fidelización está preparado.');

    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
        console.error('\nDetalles del error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
