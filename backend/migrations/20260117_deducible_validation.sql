-- ================================================================
-- MIGRATION: Deducible Validation Feature (FinSaaS)
-- Date: 2026-01-17
-- Description: Add deducible status fields to contabilidad_factura
--              and create audit log table for tracking changes
-- Compatibility: Additive (non-breaking)
-- ================================================================

-- ================================================================
-- 1. ADD DEDUCIBLE COLUMNS TO contabilidad_factura
-- ================================================================

ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_status TEXT 
    DEFAULT 'pending' CHECK (deducible_status IN ('pending', 'deducible', 'no_deducible'));

ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_reason TEXT;

ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_checked_by BIGINT 
    REFERENCES usuario(id);

ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN contabilidad_factura.deducible_status IS 
    'Estado de deducibilidad fiscal: pending, deducible, no_deducible';
COMMENT ON COLUMN contabilidad_factura.deducible_reason IS 
    'Motivo/justificación del estado de deducibilidad';
COMMENT ON COLUMN contabilidad_factura.deducible_checked_by IS 
    'Usuario que realizó la última validación de deducibilidad';
COMMENT ON COLUMN contabilidad_factura.deducible_checked_at IS 
    'Fecha/hora de la última validación de deducibilidad';

-- ================================================================
-- 2. CREATE AUDIT LOG TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS accounting_audit_log (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_empresa BIGINT REFERENCES accounting_empresa(id),
    entity_type TEXT NOT NULL,
    entity_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB,
    performed_by BIGINT REFERENCES usuario(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE accounting_audit_log IS 
    'Registro de auditoría para cambios en el módulo de contabilidad';

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_entity 
    ON accounting_audit_log(id_tenant, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_empresa 
    ON accounting_audit_log(id_tenant, id_empresa, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action 
    ON accounting_audit_log(action, performed_at DESC);

-- ================================================================
-- 3. CREATE INDEXES FOR DEDUCIBLE QUERIES
-- ================================================================

-- Index for filtering by deducible status per tenant/empresa
CREATE INDEX IF NOT EXISTS idx_factura_deducible_status 
    ON contabilidad_factura(id_tenant, id_empresa, deducible_status) 
    WHERE deleted_at IS NULL;

-- Index for quarterly deducible queries (IVA reporting)
CREATE INDEX IF NOT EXISTS idx_factura_trimestre_deducible 
    ON contabilidad_factura(
        id_tenant, 
        id_empresa, 
        EXTRACT(YEAR FROM fecha_devengo), 
        EXTRACT(QUARTER FROM fecha_devengo), 
        deducible_status
    ) WHERE deleted_at IS NULL AND tipo = 'GASTO';

-- ================================================================
-- 4. ADD NEW RBAC PERMISSION
-- ================================================================

DO $$
BEGIN
    -- Insert permission if not exists
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.deducible.approve') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES (
            'Aprobar Deducible', 
            'contabilidad.deducible.approve', 
            'contabilidad', 
            'Marcar facturas de gasto como deducible o no deducible para efectos fiscales'
        );
    END IF;
END $$;

-- Assign permission to TENANT_ADMIN role
INSERT INTO rolpermiso (id_rol, id_permiso)
SELECT r.id, p.id 
FROM rol r, permiso p 
WHERE r.nombre = 'TENANT_ADMIN' AND p.key = 'contabilidad.deducible.approve'
ON CONFLICT DO NOTHING;

-- Also assign to SUPER_ADMIN (they should have all permissions)
INSERT INTO rolpermiso (id_rol, id_permiso)
SELECT r.id, p.id 
FROM rol r, permiso p 
WHERE r.nombre = 'SUPER_ADMIN' AND p.key = 'contabilidad.deducible.approve'
ON CONFLICT DO NOTHING;

-- ================================================================
-- 5. ADD CSV EXPORT PERMISSION (optional granularity)
-- ================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.export') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES (
            'Exportar Contabilidad', 
            'contabilidad.export', 
            'contabilidad', 
            'Exportar datos contables a CSV y otros formatos'
        );
    END IF;
END $$;

-- Assign export permission to roles that should have it
INSERT INTO rolpermiso (id_rol, id_permiso)
SELECT r.id, p.id 
FROM rol r, permiso p 
WHERE r.nombre IN ('TENANT_ADMIN', 'ACCOUNTING', 'SUPER_ADMIN') 
  AND p.key = 'contabilidad.export'
ON CONFLICT DO NOTHING;

-- ================================================================
-- ✅ END OF MIGRATION
-- ================================================================
