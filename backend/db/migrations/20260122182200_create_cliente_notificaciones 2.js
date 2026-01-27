/**
 * Migration: create_cliente_notificaciones
 * Source: backend/archive/legacy-migrations/create_cliente_notificaciones.sql
 * Module: Manager
 * Risk Level: Bajo
 * 
 * Creates notification table for client portal (appointment status changes, etc).
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating cliente_notificacion table...');

    await knex.raw(`
        -- =====================================================
        -- TABLA: cliente_notificacion
        -- Notificaciones del portal cliente
        -- =====================================================
        CREATE TABLE IF NOT EXISTS cliente_notificacion (
            id SERIAL PRIMARY KEY,
            id_cliente INTEGER NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
            tipo VARCHAR(50) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            mensaje TEXT,
            leida BOOLEAN DEFAULT FALSE,
            data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Índices
        CREATE INDEX IF NOT EXISTS idx_cliente_notificacion_cliente 
            ON cliente_notificacion(id_cliente);

        CREATE INDEX IF NOT EXISTS idx_cliente_notificacion_no_leida 
            ON cliente_notificacion(id_cliente, leida) WHERE leida = FALSE;

        -- Comentarios
        COMMENT ON TABLE cliente_notificacion IS 'Notificaciones para clientes del portal (cambios de estado de citas, etc.)';
        COMMENT ON COLUMN cliente_notificacion.tipo IS 'Tipo de notificación: cita_actualizada, cita_confirmada, cita_cancelada, cita_completada, mensaje_nuevo';
    `);

    console.log('[Migration] ✅ cliente_notificacion table created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping cliente_notificacion table...');

    await knex.raw(`
        DROP TABLE IF EXISTS cliente_notificacion CASCADE;
    `);

    console.log('[Migration] ✅ cliente_notificacion table dropped');
};

exports.config = { transaction: true };
