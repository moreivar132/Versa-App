/**
 * Migración para tablas de Caja y Caja Chica
 * Ejecutar: node migrations/create_caja_chica_tables.js
 */
const pool = require('../db');

async function createTables() {
    try {
        console.log('🔧 Creando tablas de Caja...');

        // Tabla caja
        await pool.query(`
            CREATE TABLE IF NOT EXISTS caja (
                id SERIAL PRIMARY KEY,
                id_sucursal INTEGER NOT NULL REFERENCES sucursal(id),
                id_usuario_apertura INTEGER REFERENCES usuario(id),
                fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre TIMESTAMP,
                saldo_apertura DECIMAL(12,2) DEFAULT 0,
                estado VARCHAR(20) DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ Tabla caja creada');

        // Tabla cajamovimiento
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cajamovimiento (
                id SERIAL PRIMARY KEY,
                id_caja INTEGER NOT NULL REFERENCES caja(id),
                id_usuario INTEGER REFERENCES usuario(id),
                id_medio_pago INTEGER,
                tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'INTERNO')),
                monto DECIMAL(12,2) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                concepto VARCHAR(255),
                descripcion TEXT,
                origen_tipo VARCHAR(50),
                origen_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES usuario(id)
            )
        `);
        console.log('  ✓ Tabla cajamovimiento creada');

        // Tabla cajacierre
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cajacierre (
                id SERIAL PRIMARY KEY,
                id_caja INTEGER NOT NULL REFERENCES caja(id),
                id_usuario INTEGER REFERENCES usuario(id),
                fecha_cierre TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                saldo_inicial DECIMAL(12,2) NOT NULL,
                saldo_final DECIMAL(12,2) NOT NULL,
                efectivo_contado DECIMAL(12,2) NOT NULL,
                diferencia DECIMAL(12,2) DEFAULT 0,
                apertura_siguiente DECIMAL(12,2) DEFAULT 0,
                a_caja_chica DECIMAL(12,2) DEFAULT 0,
                concepto VARCHAR(255),
                descripcion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ Tabla cajacierre creada');

        // Tabla cajachica
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cajachica (
                id SERIAL PRIMARY KEY,
                id_sucursal INTEGER NOT NULL REFERENCES sucursal(id),
                saldo_actual DECIMAL(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ Tabla cajachica creada');

        // Tabla cajachicamovimiento
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cajachicamovimiento (
                id SERIAL PRIMARY KEY,
                id_caja_chica INTEGER NOT NULL REFERENCES cajachica(id),
                id_usuario INTEGER REFERENCES usuario(id),
                tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'INTERNO')),
                monto DECIMAL(12,2) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                concepto VARCHAR(255),
                descripcion TEXT,
                origen_tipo VARCHAR(50),
                origen_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES usuario(id)
            )
        `);
        console.log('  ✓ Tabla cajachicamovimiento creada');

        console.log('✅ Todas las tablas de Caja creadas correctamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
createTables();
