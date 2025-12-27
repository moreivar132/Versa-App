-- Tabla de notificaciones para clientes del portal
-- Almacena notificaciones de cambios de estado de citas, etc.

CREATE TABLE IF NOT EXISTS cliente_notificacion (
    id SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'cita_actualizada', 'cita_confirmada', 'cita_cancelada', etc.
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT,
    leida BOOLEAN DEFAULT FALSE,
    data JSONB, -- Datos adicionales (id_cita, estado_anterior, estado_nuevo, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar notificaciones por cliente
CREATE INDEX IF NOT EXISTS idx_cliente_notificacion_cliente ON cliente_notificacion(id_cliente);

-- Índice para notificaciones no leídas
CREATE INDEX IF NOT EXISTS idx_cliente_notificacion_no_leida ON cliente_notificacion(id_cliente, leida) WHERE leida = FALSE;

-- Comentarios
COMMENT ON TABLE cliente_notificacion IS 'Notificaciones para clientes del portal (cambios de estado de citas, etc.)';
COMMENT ON COLUMN cliente_notificacion.tipo IS 'Tipo de notificación: cita_actualizada, cita_confirmada, cita_cancelada, cita_completada, mensaje_nuevo';
