/**
 * VERSA - BLOQUE 7: Email Automations
 * Script para ejecutar migraciones de email automations
 * 
 * Uso: node ejecutar_migracion_email_automations.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const migrations = [
    'create_email_template.sql',
    'create_email_automation.sql',
    'create_email_event_log.sql',
    'create_email_queue.sql'
];

async function runMigrations() {
    console.log('='.repeat(60));
    console.log('VERSA - Email Automations Migrations');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        for (const migration of migrations) {
            const filePath = path.join(__dirname, 'migrations', migration);

            if (!fs.existsSync(filePath)) {
                console.error(`❌ Archivo no encontrado: ${migration}`);
                continue;
            }

            console.log(`\n📄 Ejecutando: ${migration}`);
            const sql = fs.readFileSync(filePath, 'utf8');

            await client.query(sql);
            console.log(`✅ ${migration} - Completado`);
        }

        // Verificar tablas creadas
        console.log('\n' + '-'.repeat(60));
        console.log('Verificando tablas creadas:');

        const tables = ['email_template', 'email_automation', 'email_event_log', 'email_queue'];
        for (const table of tables) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [table]);

            const exists = result.rows[0].exists;
            console.log(`  ${exists ? '✅' : '❌'} ${table}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migraciones de Email Automations completadas');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Error en migración:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
