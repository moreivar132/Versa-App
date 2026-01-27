/**
 * Run Deducible Validation Migration
 * Adds deducible fields to contabilidad_factura and creates audit log table
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    console.log('🚀 Starting deducible validation migration...\n');

    const migrationPath = path.join(__dirname, '20260117_deducible_validation.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Execute migration
        await client.query(sql);

        await client.query('COMMIT');

        console.log('✅ Migration completed successfully!\n');

        // Verification
        console.log('📋 Verifying changes...\n');

        // Check columns added to contabilidad_factura
        const columns = await client.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'contabilidad_factura' 
              AND column_name LIKE 'deducible%'
        `);
        console.log('Deducible columns in contabilidad_factura:');
        columns.rows.forEach(c => {
            console.log(`  - ${c.column_name} (${c.data_type})${c.column_default ? ` DEFAULT ${c.column_default}` : ''}`);
        });

        // Check audit log table
        const auditTable = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'accounting_audit_log'
            ) as exists
        `);
        console.log(`\nAudit log table exists: ${auditTable.rows[0].exists ? '✅' : '❌'}`);

        // Check permissions created
        const perms = await client.query(`
            SELECT key, nombre FROM permiso 
            WHERE key IN ('contabilidad.deducible.approve', 'contabilidad.export')
        `);
        console.log('\nNew permissions:');
        perms.rows.forEach(p => {
            console.log(`  - ${p.key}: ${p.nombre}`);
        });

        // Check role assignments
        const rolePerms = await client.query(`
            SELECT r.nombre as role, p.key as permission
            FROM rolpermiso rp
            JOIN rol r ON rp.id_rol = r.id
            JOIN permiso p ON rp.id_permiso = p.id
            WHERE p.key IN ('contabilidad.deducible.approve', 'contabilidad.export')
            ORDER BY r.nombre
        `);
        console.log('\nRole permission assignments:');
        rolePerms.rows.forEach(rp => {
            console.log(`  - ${rp.role} → ${rp.permission}`);
        });

        console.log('\n✨ Deducible validation migration complete!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
