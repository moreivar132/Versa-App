/**
 * Migration: create_income_event_table
 * Source: backend/archive/legacy-migrations/create_income_event_table.sql
 * Module: FinSaaS
 * Risk Level: Alto
 * 
 * Creates the income ledger system:
 * - income_event: central ledger for all income (Marketplace + CRM)
 * - Trigger for updated_at
 * - Feature gating columns on plan_suscripcion
 * - Summary view for income reports
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating income_event ledger table...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: income_event - Ledger central de ingresos
        -- =====================================================
        CREATE TABLE IF NOT EXISTS income_event (
            id             BIGSERIAL PRIMARY KEY,
            id_tenant      BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal    BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
            
            origen         TEXT NOT NULL CHECK (origen IN ('marketplace','crm','subscription','manual')),
            origin_type    TEXT NOT NULL,
            origin_id      BIGINT NULL,
            
            id_cliente     BIGINT NULL REFERENCES clientefinal(id) ON DELETE SET NULL,
            
            amount         NUMERIC(14,2) NOT NULL,
            currency       TEXT NOT NULL DEFAULT 'EUR',
            
            status         TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded','canceled')),
            
            provider       TEXT NOT NULL DEFAULT 'internal',
            reference      TEXT NOT NULL,
            
            metadata       JSONB NULL,
            description    TEXT NULL,
            
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- Índices
        CREATE UNIQUE INDEX IF NOT EXISTS ux_income_event_reference 
        ON income_event(id_tenant, reference);

        CREATE INDEX IF NOT EXISTS idx_income_event_tenant_fecha 
        ON income_event(id_tenant, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_income_event_origen_status 
        ON income_event(origen, status);

        CREATE INDEX IF NOT EXISTS idx_income_event_sucursal 
        ON income_event(id_sucursal, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_income_event_paid 
        ON income_event(id_tenant, created_at DESC) 
        WHERE status = 'paid';

        CREATE INDEX IF NOT EXISTS idx_income_event_marketplace 
        ON income_event(id_tenant, id_sucursal, created_at DESC) 
        WHERE origen = 'marketplace' AND status = 'paid';

        CREATE INDEX IF NOT EXISTS idx_income_event_crm 
        ON income_event(id_tenant, id_sucursal, created_at DESC) 
        WHERE origen = 'crm' AND status = 'paid';

        -- Comentarios
        COMMENT ON TABLE income_event IS 'Ledger central de ingresos - fuente de verdad para reportes financieros';
        COMMENT ON COLUMN income_event.origen IS 'Origen del ingreso: marketplace, crm, subscription, manual';
        COMMENT ON COLUMN income_event.origin_type IS 'Tipo de entidad origen: cita, orden, venta, factura, manual';
        COMMENT ON COLUMN income_event.reference IS 'Clave única para idempotencia';
        COMMENT ON COLUMN income_event.provider IS 'Proveedor del pago: stripe, cash, transfer, card, internal';

        -- =====================================================
        -- 2. TRIGGER para updated_at
        -- =====================================================
        CREATE OR REPLACE FUNCTION update_income_event_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_income_event_updated_at ON income_event;
        CREATE TRIGGER trg_income_event_updated_at
        BEFORE UPDATE ON income_event
        FOR EACH ROW
        EXECUTE FUNCTION update_income_event_updated_at();

        -- =====================================================
        -- 3. ACTUALIZAR planes existentes con features
        -- =====================================================
        UPDATE plan_suscripcion 
        SET features_json = COALESCE(features_json, '{}')::jsonb || '{"max_usuarios": 2, "max_sucursales": 1}'::jsonb
        WHERE nombre = 'BASIC' AND features_json IS NULL OR features_json = '{}'::jsonb;

        UPDATE plan_suscripcion 
        SET features_json = COALESCE(features_json, '{}')::jsonb || '{"max_usuarios": 6, "max_sucursales": 3}'::jsonb
        WHERE nombre = 'PRO' AND features_json IS NULL OR features_json = '{}'::jsonb;

        UPDATE plan_suscripcion 
        SET features_json = COALESCE(features_json, '{}')::jsonb || '{"max_usuarios": -1, "max_sucursales": -1, "api_access": true}'::jsonb
        WHERE nombre = 'FLEET' AND features_json IS NULL OR features_json = '{}'::jsonb;

        -- =====================================================
        -- 4. VISTA para reportes rápidos de ingresos
        -- =====================================================
        CREATE OR REPLACE VIEW v_income_summary AS
        SELECT 
            ie.id_tenant,
            ie.id_sucursal,
            s.nombre AS sucursal_nombre,
            ie.origen,
            ie.status,
            DATE_TRUNC('day', ie.created_at) AS fecha,
            COUNT(*) AS num_eventos,
            SUM(ie.amount) AS total_amount,
            ie.currency
        FROM income_event ie
        JOIN sucursal s ON ie.id_sucursal = s.id
        GROUP BY ie.id_tenant, ie.id_sucursal, s.nombre, ie.origen, ie.status, DATE_TRUNC('day', ie.created_at), ie.currency;

        COMMENT ON VIEW v_income_summary IS 'Vista resumida de ingresos por día, origen y sucursal';
    `);

    console.log('[Migration] ✅ income_event ledger table created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping income_event table...');

    await knex.raw(`
        DROP VIEW IF EXISTS v_income_summary;
        DROP TRIGGER IF EXISTS trg_income_event_updated_at ON income_event;
        DROP FUNCTION IF EXISTS update_income_event_updated_at();
        DROP TABLE IF EXISTS income_event CASCADE;
    `);

    console.log('[Migration] ✅ income_event table dropped');
};

exports.config = { transaction: true };
