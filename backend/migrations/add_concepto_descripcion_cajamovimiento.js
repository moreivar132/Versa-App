/**
 * Migración para agregar columnas concepto y descripcion a cajamovimiento
 * Ejecutar: node migrations/add_concepto_descripcion_cajamovimiento.js
 */
const pool = require('../db');

async function migrate() {
    try {
        console.log('🔧 Agregando columnas a cajamovimiento...');

        // Agregar columna concepto si no existe
        await pool.query(`
            ALTER TABLE cajamovimiento 
            ADD COLUMN IF NOT EXISTS concepto VARCHAR(255)
        `);
        console.log('  ✓ Columna concepto agregada');

        // Agregar columna descripcion si no existe
        await pool.query(`
            ALTER TABLE cajamovimiento 
            ADD COLUMN IF NOT EXISTS descripcion TEXT
        `);
        console.log('  ✓ Columna descripcion agregada');

        console.log('✅ Migración completada correctamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

migrate();
