/**
 * Migration: FinSaaS Egresos OCR
 * @description Consolidation tables for OCR intake processing
 */

exports.up = async function (knex) {
    // 1. Create accounting_intake table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS accounting_intake (
            id SERIAL PRIMARY KEY,
            id_tenant VARCHAR(255) NOT NULL,
            id_empresa INTEGER NOT NULL REFERENCES accounting_empresa(id),
            created_by INTEGER REFERENCES usuario(id),
            
            idempotency_key UUID NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'needs_review', 'failed')),
            source VARCHAR(50) DEFAULT 'portal',
            
            file_storage_key VARCHAR(500),
            file_url TEXT,
            file_mime VARCHAR(100),
            file_original_name VARCHAR(255),
            file_size_bytes INTEGER,
            
            extracted_json JSONB,
            validation_json JSONB,
            trace_id VARCHAR(100),
            
            error_code VARCHAR(50),
            error_message TEXT,
            
            categoria_ui VARCHAR(100),
            metodo_pago_hint VARCHAR(50),
            
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            UNIQUE(id_empresa, idempotency_key)
        );
    `);

    // 2. Add columns to existing tables
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS id_empresa INTEGER REFERENCES accounting_empresa(id);`);
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS intake_id INTEGER REFERENCES accounting_intake(id);`);
    await knex.raw(`ALTER TABLE contabilidad_contacto ADD COLUMN IF NOT EXISTS id_empresa INTEGER REFERENCES accounting_empresa(id);`);

    // 3. Create indexes
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_factura_empresa ON contabilidad_factura(id_empresa);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_factura_intake ON contabilidad_factura(intake_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_contacto_empresa ON contabilidad_contacto(id_empresa);`);
};

exports.down = async function (knex) {
    await knex.raw(`DROP INDEX IF EXISTS idx_contacto_empresa;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_factura_intake;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_factura_empresa;`);
    await knex.raw(`ALTER TABLE contabilidad_contacto DROP COLUMN IF EXISTS id_empresa;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS intake_id;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS id_empresa;`);
    await knex.raw(`DROP TABLE IF EXISTS accounting_intake CASCADE;`);
};

exports.config = { transaction: true };
