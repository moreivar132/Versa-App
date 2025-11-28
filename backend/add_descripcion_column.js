require('dotenv').config();
const pool = require('./db');

async function runMigration() {
    try {
        console.log('🔌 Conectando a la base de datos...');

        // Check if column exists first to avoid errors
        const checkResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='permiso' AND column_name='descripcion';
        `);

        if (checkResult.rows.length > 0) {
            console.log('⚠️ La columna "descripcion" ya existe en la tabla "permiso".');
        } else {
            console.log('📝 Agregando columna "descripcion" a la tabla "permiso"...');
            await pool.query('ALTER TABLE permiso ADD COLUMN descripcion TEXT;');
            console.log('✅ Columna "descripcion" agregada exitosamente.');
        }

    } catch (err) {
        console.error('❌ Error al ejecutar la migración:', err);
    } finally {
        pool.end();
    }
}

runMigration();
