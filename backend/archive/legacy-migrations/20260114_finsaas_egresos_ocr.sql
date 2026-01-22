-- ================================================================
-- MIGRACIÓN: Consolidación Egresos OCR (FinSaaS)
-- Fecha: 2026-01-14
-- Descripción: Añadir columnas necesarias a tablas existentes
-- ================================================================

-- 1. Tabla de intakes (mantenemos esta para tracking del proceso OCR)
CREATE TABLE IF NOT EXISTS accounting_intake (
    id SERIAL PRIMARY KEY,
    id_tenant VARCHAR(255) NOT NULL,
    id_empresa INTEGER NOT NULL REFERENCES accounting_empresa(id),
    created_by INTEGER REFERENCES usuario(id),
    
    idempotency_key UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'needs_review', 'failed')),
    source VARCHAR(50) DEFAULT 'portal',
    
    -- Archivo
    file_storage_key VARCHAR(500),
    file_url TEXT,
    file_mime VARCHAR(100),
    file_original_name VARCHAR(255),
    file_size_bytes INTEGER,
    
    -- Resultado OCR
    extracted_json JSONB,
    validation_json JSONB,
    trace_id VARCHAR(100),
    
    -- Errores
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Metadata
    categoria_ui VARCHAR(100),
    metodo_pago_hint VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(id_empresa, idempotency_key)
);

-- 2. Asegurar columnas en tablas existentes de contabilidad v3
-- Si ya existen no pasará nada, pero necesitamos id_empresa e intake_id

ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS id_empresa INTEGER REFERENCES accounting_empresa(id);
ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS intake_id INTEGER REFERENCES accounting_intake(id);

ALTER TABLE contabilidad_contacto ADD COLUMN IF NOT EXISTS id_empresa INTEGER REFERENCES accounting_empresa(id);

-- Índices para mejorar performance con el nuevo filtrado
CREATE INDEX IF NOT EXISTS idx_factura_empresa ON contabilidad_factura(id_empresa);
CREATE INDEX IF NOT EXISTS idx_factura_intake ON contabilidad_factura(intake_id);
CREATE INDEX IF NOT EXISTS idx_contacto_empresa ON contabilidad_contacto(id_empresa);

-- 3. Tabla de adjuntos (opcional, si no queremos usar contabilidad_factura_archivo)
-- Pero contabilidad_factura_archivo ya existe y funciona bien.
-- Mantenemos contabilidad_factura_archivo como el estándar.
