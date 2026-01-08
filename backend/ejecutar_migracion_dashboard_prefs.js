/**
 * Script para ejecutar la migración de preferencias de dashboard
 */
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigration() {
    console.log('🚀 Ejecutando migración: user_dashboard_prefs...');

    try {
        const sqlPath = path.join(__dirname, 'migrations', 'create_user_dashboard_prefs.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Migración completada exitosamente');

        // Verificar que la tabla existe
        const check = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name = 'user_dashboard_prefs'
        `);

        if (check.rows.length > 0) {
            console.log('✅ Tabla user_dashboard_prefs verificada');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        process.exit(1);
    }
}

runMigration();
