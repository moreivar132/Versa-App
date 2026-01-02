// Script para crear la tabla ordenconfigtenant
const pool = require('../db');

async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ordenconfigtenant (
                id SERIAL PRIMARY KEY,
                id_tenant INTEGER NOT NULL,
                nombre_taller VARCHAR(255) DEFAULT 'GOVERSA',
                logo_url TEXT,
                color_primario VARCHAR(20) DEFAULT '#ff652b',
                cabecera_html TEXT,
                pie_html TEXT,
                condiciones_html TEXT,
                mostrar_logo BOOLEAN DEFAULT true,
                mostrar_matricula BOOLEAN DEFAULT true,
                mostrar_kilometraje BOOLEAN DEFAULT true,
                mostrar_tecnico BOOLEAN DEFAULT true,
                mostrar_precios BOOLEAN DEFAULT true,
                mostrar_iva BOOLEAN DEFAULT true,
                mostrar_firma_cliente BOOLEAN DEFAULT true,
                es_por_defecto BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tabla ordenconfigtenant creada correctamente');

        // Crear índice único para tenant + es_por_defecto
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenconfigtenant_tenant_default 
            ON ordenconfigtenant(id_tenant) WHERE es_por_defecto = true;
        `);
        console.log('✅ Índice único creado correctamente');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando tabla:', error.message);
        process.exit(1);
    }
}

createTable();
