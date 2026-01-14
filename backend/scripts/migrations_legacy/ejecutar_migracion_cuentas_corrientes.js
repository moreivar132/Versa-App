/**
 * Script para ejecutar la migración de Cuentas Corrientes
 * Ejecutar: node ejecutar_migracion_cuentas_corrientes.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function ejecutarMigracion() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log('🚀 Iniciando migración de Cuentas Corrientes...\n');

    try {
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'migrations', 'create_cuentas_corrientes_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('📄 Ejecutando script SQL...\n');

        // Ejecutar el SQL
        await pool.query(sql);

        console.log('✅ Migración completada exitosamente!\n');
        console.log('Tablas creadas/actualizadas:');
        console.log('  - cuentacorriente');
        console.log('  - movimientocuenta');
        console.log('  - Columnas añadidas a tabla orden');
        console.log('  - Trigger para actualización automática de saldos');
        console.log('  - Vista v_cuentas_corrientes_resumen\n');

        // Verificar las tablas
        const tablas = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('cuentacorriente', 'movimientocuenta')
            ORDER BY table_name
        `);

        console.log('📊 Verificación de tablas:');
        tablas.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });

        // Verificar columnas en orden
        const columnas = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orden' 
            AND column_name IN ('en_cuenta_corriente', 'id_cuenta_corriente')
        `);

        console.log('\n📊 Columnas añadidas a orden:');
        columnas.rows.forEach(row => {
            console.log(`  ✓ ${row.column_name}`);
        });

    } catch (error) {
        console.error('❌ Error en la migración:', error.message);
        if (error.detail) console.error('Detalle:', error.detail);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

ejecutarMigracion();
