/**
 * Script para ejecutar las migraciones de facturación
 * Ejecutar con: node ejecutar_migracion_facturacion.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function ejecutarMigracion() {
    console.log('🚀 Iniciando migración de facturación...\n');

    const client = await pool.connect();

    try {
        // Leer el archivo SQL
        const sqlFile = path.join(__dirname, 'migrations', 'create_facturacion_tables.sql');
        const sql = fs.readFileSync(sqlFile, 'utf-8');

        console.log('📄 Ejecutando SQL desde:', sqlFile);
        console.log('='.repeat(60));

        // Ejecutar el SQL
        await client.query(sql);

        console.log('\n✅ Migración ejecutada correctamente!');
        console.log('\nTablas creadas:');
        console.log('  - FacturaSerie');
        console.log('  - FacturaConfigTenant');
        console.log('  - FacturaCabecera');
        console.log('  - FacturaLinea');
        console.log('  - FacturaPago');
        console.log('\nColumnas añadidas a Orden:');
        console.log('  - requiere_factura');
        console.log('  - id_factura');

        // Verificar las tablas creadas
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%actura%'
      ORDER BY table_name;
    `);

        console.log('\n📊 Tablas de facturación en la base de datos:');
        result.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name}`);
        });

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
