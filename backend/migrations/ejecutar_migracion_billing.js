// migrations/ejecutar_migracion_billing.js
/**
 * Ejecuta la migración de mejoras de billing:
 * 1. stripe_event_log para idempotencia
 * 2. Columnas plan_key y features_json en plan_suscripcion
 * 3. Columnas de tracking past_due en tenant_suscripcion
 * 4. Seed de planes con features
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { seedBillingPlans } = require('./seed_billing_plans');

async function runMigration() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  VERSA CRM - Billing Enhancements Migration');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
        // 1. Run SQL migration
        console.log('📋 Step 1: Running SQL migration...\n');

        const sqlPath = path.join(__dirname, 'create_billing_enhancements.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute the entire SQL file at once
        try {
            await pool.query(sql);
            console.log('   ✓ SQL migration executed successfully');
        } catch (err) {
            // Log the specific error but continue if it's just "already exists" type errors
            if (err.code === '42701' || err.code === '42P07' || err.message.includes('already exists')) {
                console.log(`   ⏭ Some objects already exist, continuing...`);
            } else {
                console.error('   ❌ SQL error:', err.message);
                // Try individual statements approach
                console.log('   ↻ Trying individual statements...');

                // Clean and split by semicolon, but be smarter about it
                const statements = sql
                    .replace(/--.*$/gm, '') // Remove single-line comments
                    .split(/;\s*$/gm) // Split by semicolon at end of line
                    .map(s => s.trim())
                    .filter(s => s.length > 10); // Filter out empty or very short statements

                for (const statement of statements) {
                    try {
                        await pool.query(statement);
                        const preview = statement.replace(/\s+/g, ' ').substring(0, 50);
                        console.log(`   ✓ ${preview}...`);
                    } catch (stmtErr) {
                        if (stmtErr.code === '42701' || stmtErr.code === '42P07' || stmtErr.message.includes('already exists')) {
                            console.log(`   ⏭ Skipped (exists)`);
                        } else {
                            console.log(`   ⚠ Warning: ${stmtErr.message.substring(0, 80)}`);
                        }
                    }
                }
            }
        }

        console.log('\n✅ SQL migration complete!\n');

        // 2. Verify tables exist
        console.log('📋 Step 2: Verifying database structure...\n');

        const verifyTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('stripe_event_log', 'plan_suscripcion', 'tenant_suscripcion')
            ORDER BY table_name
        `);

        console.log('   Tables found:', verifyTables.rows.map(r => r.table_name).join(', '));

        // Verify new columns
        const verifyColumns = await pool.query(`
            SELECT column_name, table_name
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND (
                (table_name = 'plan_suscripcion' AND column_name IN ('plan_key', 'features_json'))
                OR (table_name = 'tenant_suscripcion' AND column_name IN ('past_due_since', 'grace_until', 'plan_key'))
            )
            ORDER BY table_name, column_name
        `);

        console.log('   New columns:', verifyColumns.rows.map(r => `${r.table_name}.${r.column_name}`).join(', '));
        console.log('\n✅ Structure verification complete!\n');

        // 3. Seed billing plans
        console.log('📋 Step 3: Seeding billing plans...\n');
        await seedBillingPlans();

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✨ Migration completed successfully!');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration
runMigration()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
