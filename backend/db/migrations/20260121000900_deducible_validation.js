/**
 * Migration: Deducible Validation
 * @description Adds deducible status fields and audit log for tax compliance
 */

exports.up = async function (knex) {
    // 1. Add deducible columns to contabilidad_factura
    await knex.raw(`
        ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_status TEXT 
            DEFAULT 'pending' CHECK (deducible_status IN ('pending', 'deducible', 'no_deducible'));
    `);
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_reason TEXT;`);
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_checked_by BIGINT REFERENCES usuario(id);`);
    await knex.raw(`ALTER TABLE contabilidad_factura ADD COLUMN IF NOT EXISTS deducible_checked_at TIMESTAMPTZ;`);

    // 2. Add comments
    await knex.raw(`COMMENT ON COLUMN contabilidad_factura.deducible_status IS 'Estado de deducibilidad fiscal: pending, deducible, no_deducible';`);
    await knex.raw(`COMMENT ON COLUMN contabilidad_factura.deducible_reason IS 'Motivo/justificación del estado de deducibilidad';`);
    await knex.raw(`COMMENT ON COLUMN contabilidad_factura.deducible_checked_by IS 'Usuario que realizó la última validación';`);
    await knex.raw(`COMMENT ON COLUMN contabilidad_factura.deducible_checked_at IS 'Fecha/hora de la última validación';`);

    // 3. Create audit log table
    await knex.raw(`
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
    `);

    await knex.raw(`COMMENT ON TABLE accounting_audit_log IS 'Registro de auditoría para cambios en el módulo de contabilidad';`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_entity ON accounting_audit_log(id_tenant, entity_type, entity_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_empresa ON accounting_audit_log(id_tenant, id_empresa, performed_at DESC);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON accounting_audit_log(action, performed_at DESC);`);

    // 4. Create indexes for deducible queries
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_factura_deducible_status ON contabilidad_factura(id_tenant, id_empresa, deducible_status) WHERE deleted_at IS NULL;`);
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_factura_trimestre_deducible 
            ON contabilidad_factura(id_tenant, id_empresa, EXTRACT(YEAR FROM fecha_devengo), EXTRACT(QUARTER FROM fecha_devengo), deducible_status) 
            WHERE deleted_at IS NULL AND tipo = 'GASTO';
    `);

    // 5. Add RBAC permissions
    await knex.raw(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.deducible.approve') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Aprobar Deducible', 'contabilidad.deducible.approve', 'contabilidad', 'Marcar facturas de gasto como deducible o no deducible');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.export') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Exportar Contabilidad', 'contabilidad.export', 'contabilidad', 'Exportar datos contables a CSV y otros formatos');
            END IF;
        END $$;
    `);

    // 6. Assign permissions to roles
    await knex.raw(`
        INSERT INTO rolpermiso (id_rol, id_permiso)
        SELECT r.id, p.id FROM rol r, permiso p 
        WHERE r.nombre = 'TENANT_ADMIN' AND p.key = 'contabilidad.deducible.approve'
        ON CONFLICT DO NOTHING;
    `);
    await knex.raw(`
        INSERT INTO rolpermiso (id_rol, id_permiso)
        SELECT r.id, p.id FROM rol r, permiso p 
        WHERE r.nombre = 'SUPER_ADMIN' AND p.key = 'contabilidad.deducible.approve'
        ON CONFLICT DO NOTHING;
    `);
    await knex.raw(`
        INSERT INTO rolpermiso (id_rol, id_permiso)
        SELECT r.id, p.id FROM rol r, permiso p 
        WHERE r.nombre IN ('TENANT_ADMIN', 'ACCOUNTING', 'SUPER_ADMIN') AND p.key = 'contabilidad.export'
        ON CONFLICT DO NOTHING;
    `);
};

exports.down = async function (knex) {
    await knex.raw(`DROP INDEX IF EXISTS idx_factura_trimestre_deducible;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_factura_deducible_status;`);
    await knex.raw(`DROP TABLE IF EXISTS accounting_audit_log CASCADE;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS deducible_checked_at;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS deducible_checked_by;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS deducible_reason;`);
    await knex.raw(`ALTER TABLE contabilidad_factura DROP COLUMN IF EXISTS deducible_status;`);
};

exports.config = { transaction: true };
