/**
 * Migración: Contable V2 - Tablas Adicionales
 * 
 * Ejecuta: node migrations/run_contable_v2_migration.js
 * 
 * Este script ejecuta la migración SQL para crear:
 * - contable_category (categorías de ingreso/gasto)
 * - contable_bill (facturas recibidas)
 * - contable_bill_line (líneas de facturas recibidas)
 * - audit_log (trazabilidad)
 * - Columnas adicionales en facturacabecera y cajamovimiento
 * - Permisos RBAC para el módulo contable
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Iniciando migración Contable V2...\n');

        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'create_contable_v2_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Ejecutar en una transacción
        await client.query('BEGIN');

        console.log('📦 Ejecutando migración SQL...');
        await client.query(sql);

        await client.query('COMMIT');

        console.log('\n✅ Migración Contable V2 completada exitosamente!\n');

        // Verificar tablas creadas
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('contable_category', 'contable_bill', 'contable_bill_line', 'audit_log')
            ORDER BY table_name
        `);

        console.log('📋 Tablas creadas/verificadas:');
        tables.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));

        // Verificar permisos insertados
        const permisos = await client.query(`
            SELECT nombre FROM permiso WHERE nombre LIKE 'CONTABLE_%' ORDER BY nombre
        `);

        console.log('\n🔐 Permisos RBAC:');
        permisos.rows.forEach(row => console.log(`   ✓ ${row.nombre}`));

        // Verificar categorías
        const categorias = await client.query(`
            SELECT id_tenant, COUNT(*) as total FROM contable_category GROUP BY id_tenant
        `);

        console.log('\n📂 Categorías por tenant:');
        categorias.rows.forEach(row =>
            console.log(`   Tenant ${row.id_tenant}: ${row.total} categorías`)
        );

        console.log('\n🎉 Todo listo para usar el módulo Contable V2!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error en la migración:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

runMigration();
