/**
 * Script para ejecutar las migraciones de marketplace pagos
 * Ejecuta: create_marketplace_reserva_pago.sql y create_clientefinal_credito_mov.sql
 * 
 * Uso: node ejecutar_migracion_marketplace_pagos.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const MIGRATIONS = [
    {
        name: 'marketplace_reserva_pago',
        file: 'create_marketplace_reserva_pago.sql',
        description: 'Tabla de pagos de reservas del marketplace'
    },
    {
        name: 'clientefinal_credito_mov',
        file: 'create_clientefinal_credito_mov.sql',
        description: 'Tabla de movimientos de crédito (saldo a favor)'
    }
];

async function executeMigration(migration) {
    const filePath = path.join(__dirname, 'migrations', migration.file);

    console.log(`\n📦 Ejecutando migración: ${migration.name}`);
    console.log(`   Descripción: ${migration.description}`);
    console.log(`   Archivo: ${migration.file}`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo de migración no encontrado: ${filePath}`);
    }

    const sql = fs.readFileSync(filePath, 'utf8');

    try {
        await pool.query(sql);
        console.log(`   ✅ Migración completada exitosamente`);
        return { success: true, name: migration.name };
    } catch (error) {
        console.error(`   ❌ Error en migración: ${error.message}`);
        return { success: false, name: migration.name, error: error.message };
    }
}

async function runMigrations() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('     VERSA - Migraciones de Marketplace Pagos');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nIniciando migraciones... (${new Date().toISOString()})`);

    const results = [];

    for (const migration of MIGRATIONS) {
        try {
            const result = await executeMigration(migration);
            results.push(result);
        } catch (error) {
            results.push({
                success: false,
                name: migration.name,
                error: error.message
            });
        }
    }

    // Resumen final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('     RESUMEN DE MIGRACIONES');
    console.log('═══════════════════════════════════════════════════════════');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
        console.log('\n✅ Exitosas:');
        successful.forEach(r => console.log(`   - ${r.name}`));
    }

    if (failed.length > 0) {
        console.log('\n❌ Fallidas:');
        failed.forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    console.log(`\nTotal: ${successful.length}/${results.length} migraciones exitosas`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...\n');

    try {
        const tablesCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('marketplace_reserva_pago', 'clientefinal_credito_mov')
            ORDER BY table_name
        `);

        if (tablesCheck.rows.length > 0) {
            console.log('Tablas encontradas:');
            tablesCheck.rows.forEach(row => {
                console.log(`   ✓ ${row.table_name}`);
            });
        } else {
            console.log('⚠️  No se encontraron las tablas esperadas');
        }

        // Verificar vista
        const viewCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'vw_clientefinal_saldo'
        `);

        if (viewCheck.rows.length > 0) {
            console.log('\n   ✓ Vista vw_clientefinal_saldo creada');
        }

    } catch (error) {
        console.error('Error verificando tablas:', error.message);
    }

    // Cerrar conexión
    await pool.end();

    process.exit(failed.length > 0 ? 1 : 0);
}

// Ejecutar
runMigrations().catch(error => {
    console.error('Error fatal ejecutando migraciones:', error);
    process.exit(1);
});
