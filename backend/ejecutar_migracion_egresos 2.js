/**
 * Script para ejecutar las migraciones de Egresos/OCR
 * Ejecutar con: node ejecutar_migracion_egresos.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function ejecutarMigracion() {
    console.log('🚀 Iniciando migración de Egresos OCR...\n');

    const client = await pool.connect();

    try {
        // Leer el archivo SQL
        const sqlFile = path.join(__dirname, 'migrations', '20260114_finsaas_egresos_ocr.sql');
        const sql = fs.readFileSync(sqlFile, 'utf-8');

        console.log('📄 Ejecutando SQL desde:', sqlFile);
        console.log('='.repeat(60));

        // Ejecutar el SQL
        await client.query(sql);

        console.log('\n✅ Migración ejecutada correctamente!');
        console.log('\nTablas creadas/actualizadas:');
        console.log('  - accounting_intake');
        console.log('  - accounting_gasto_documento');
        console.log('  - accounting_adjunto');
        console.log('  - accounting_pago');

    } catch (error) {
        console.error('\n❌ Error al ejecutar la migración:');
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
ejecutarMigracion();
