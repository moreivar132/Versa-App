/**
 * Migration Runner: Accounting Empresa V2
 * Ejecuta la migración para multi-empresa
 * 
 * Uso: node migrations/run_accounting_empresa_migration.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Iniciando migración Accounting Empresa V2...\n');

    const client = await pool.connect();

    try {
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'create_accounting_empresa.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Archivo SQL cargado');
        console.log('📊 Ejecutando migración...\n');

        // Ejecutar el SQL completo
        await client.query(sql);

        console.log('✅ Migración completada!\n');

        // Verificar tablas creadas
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'accounting_%'
            ORDER BY table_name
        `);

        console.log('📋 Tablas creadas:');
        tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        // Verificar empresas creadas
        const empresasResult = await client.query(`
            SELECT e.id, e.id_tenant, e.nombre_legal, e.nif_cif, e.es_default
            FROM accounting_empresa e
            ORDER BY e.id_tenant, e.id
        `);

        console.log('\n🏢 Empresas contables:');
        empresasResult.rows.forEach(row => {
            console.log(`   Tenant ${row.id_tenant}: ${row.nombre_legal} (${row.nif_cif}) ${row.es_default ? '⭐ default' : ''}`);
        });

        // Verificar cuentas de tesorería
        const cuentasResult = await client.query(`
            SELECT c.id, c.nombre, c.tipo, e.nombre_legal
            FROM accounting_cuenta_tesoreria c
            JOIN accounting_empresa e ON c.id_empresa = e.id
            ORDER BY c.id
        `);

        console.log('\n💰 Cuentas de tesorería:');
        cuentasResult.rows.forEach(row => {
            console.log(`   ${row.nombre} (${row.tipo}) - ${row.nombre_legal}`);
        });

        // Verificar permisos insertados
        const permsResult = await client.query(`
            SELECT key, descripcion 
            FROM permiso 
            WHERE key LIKE 'contabilidad.empresa%' OR key LIKE 'contabilidad.tesoreria%'
        `);

        console.log('\n🔐 Permisos insertados:');
        permsResult.rows.forEach(row => {
            console.log(`   - ${row.key}: ${row.descripcion}`);
        });

        console.log('\n✨ Migración verificada correctamente!');

    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
