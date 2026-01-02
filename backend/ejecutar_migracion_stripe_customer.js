// Script para ejecutar la migración de stripe_customer_id
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('     VERSA - Migración: Stripe Customer para Clientes');
    console.log('═══════════════════════════════════════════════════════════\n');

    const client = await pool.connect();

    try {
        const migrationPath = path.join(__dirname, 'migrations', 'add_stripe_customer_to_client.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📦 Ejecutando migración...');
        await client.query(sql);
        console.log('   ✅ Migración completada exitosamente\n');

        // Verificar que las columnas se añadieron
        const checkResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'clientefinal_auth' 
            AND column_name IN ('stripe_customer_id', 'stripe_default_payment_method_id')
        `);

        console.log('🔍 Verificando columnas añadidas...\n');
        if (checkResult.rows.length > 0) {
            checkResult.rows.forEach(row => {
                console.log(`   ✓ ${row.column_name} (${row.data_type})`);
            });
        } else {
            console.log('   ⚠️  No se encontraron las nuevas columnas');
        }

    } catch (error) {
        console.error('❌ Error ejecutando migración:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('     MIGRACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════\n');
}

runMigration().catch(err => {
    console.error(err);
    process.exit(1);
});
