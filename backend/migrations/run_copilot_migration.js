const db = require('../db');

async function runMigration() {
    const fs = require('fs');
    const path = require('path');

    console.log('🚀 Iniciando migración: Copiloto Contable IA...');

    try {
        const sqlPath = path.join(__dirname, '20260115_copilot_contable.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await db.query(sql);

        console.log('✅ Migración completada exitosamente');
        console.log('   - Tablas creadas: copilot_chat_session, copilot_chat_message, copilot_alert_rule, copilot_alert_event');
        console.log('   - Triggers y funciones creados');
        console.log('   - Permisos RBAC insertados');
        console.log('   - Reglas de alerta por defecto insertadas');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
