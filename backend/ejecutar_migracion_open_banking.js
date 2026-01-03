/**
 * Script para ejecutar la migración de Open Banking
 */
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
    console.log('🚀 Iniciando migración de Open Banking...');

    const sqlPath = path.join(__dirname, 'migrations', 'create_open_banking_tables.sql');

    if (!fs.existsSync(sqlPath)) {
        console.error('❌ No se encontró el archivo de migración:', sqlPath);
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await pool.query(sql);
        console.log('✅ Migración de Open Banking completada exitosamente!');
        console.log('   - bank_connection');
        console.log('   - bank_account');
        console.log('   - bank_transaction');
        console.log('   - bank_sync_run');
        console.log('   - bank_reconciliation_rule (placeholder)');
        console.log('   - bank_transaction_match (placeholder)');
        console.log('   - accounting_category (placeholder)');
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error.message);
        if (error.detail) console.error('   Detalle:', error.detail);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
