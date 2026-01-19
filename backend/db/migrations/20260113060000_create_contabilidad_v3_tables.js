/**
 * Migration: create_contabilidad_v3_tables
 * Source: backend/migrations/create_contabilidad_v3.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates accounting module V3 tables:
 * - contabilidad_contacto: fiscal contacts (suppliers/customers)
 * - contabilidad_factura: unified invoices (income/expense)
 * - contabilidad_factura_archivo: invoice attachments
 * - contabilidad_pago: payments against invoices
 * - contabilidad_trimestre: quarterly VAT closings
 * - Helper functions for quarter and VAT calculations
 * - Trigger for auto-updating invoice status on payment
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating contabilidad V3 tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: contabilidad_contacto
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contabilidad_contacto (
            id              BIGSERIAL PRIMARY KEY,
            id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            tipo            TEXT NOT NULL CHECK (tipo IN ('PROVEEDOR', 'CLIENTE')),
            nombre          TEXT NOT NULL,
            nif_cif         TEXT,
            email           TEXT,
            telefono        TEXT,
            direccion       TEXT,
            codigo_postal   TEXT,
            ciudad          TEXT,
            provincia       TEXT,
            pais            TEXT DEFAULT 'ES',
            activo          BOOLEAN NOT NULL DEFAULT true,
            notas           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by      BIGINT REFERENCES usuario(id),
            updated_at      TIMESTAMPTZ,
            updated_by      BIGINT REFERENCES usuario(id),
            deleted_at      TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_contab_contacto_tenant 
            ON contabilidad_contacto(id_tenant) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_contab_contacto_tipo 
            ON contabilidad_contacto(id_tenant, tipo) WHERE activo = true;
        CREATE INDEX IF NOT EXISTS idx_contab_contacto_nombre 
            ON contabilidad_contacto(id_tenant, nombre) WHERE activo = true;

        CREATE UNIQUE INDEX IF NOT EXISTS ux_contab_contacto_nif 
            ON contabilidad_contacto(id_tenant, nif_cif) 
            WHERE nif_cif IS NOT NULL AND deleted_at IS NULL;

        COMMENT ON TABLE contabilidad_contacto IS 'Contactos fiscales para facturas (proveedores y clientes)';

        -- =====================================================
        -- 2. TABLA: contabilidad_factura
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contabilidad_factura (
            id                  BIGSERIAL PRIMARY KEY,
            id_tenant           BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal         BIGINT REFERENCES sucursal(id),
            tipo                TEXT NOT NULL CHECK (tipo IN ('GASTO', 'INGRESO')),
            id_contacto         BIGINT REFERENCES contabilidad_contacto(id),
            numero_factura      TEXT NOT NULL,
            fecha_emision       DATE NOT NULL,
            fecha_devengo       DATE NOT NULL,
            fecha_vencimiento   DATE,
            moneda              TEXT NOT NULL DEFAULT 'EUR',
            base_imponible      NUMERIC(14,2) NOT NULL DEFAULT 0,
            iva_porcentaje      NUMERIC(5,2) NOT NULL DEFAULT 21,
            iva_importe         NUMERIC(14,2) NOT NULL DEFAULT 0,
            total               NUMERIC(14,2) NOT NULL DEFAULT 0,
            total_pagado        NUMERIC(14,2) NOT NULL DEFAULT 0,
            estado              TEXT NOT NULL DEFAULT 'PENDIENTE' 
                                CHECK (estado IN ('PENDIENTE', 'PAGADA', 'PARCIAL', 'VENCIDA', 'ANULADA')),
            id_categoria        BIGINT REFERENCES contable_category(id),
            notas               TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by          BIGINT REFERENCES usuario(id),
            updated_at          TIMESTAMPTZ,
            updated_by          BIGINT REFERENCES usuario(id),
            deleted_at          TIMESTAMPTZ,
            
            CONSTRAINT chk_contab_factura_totales 
                CHECK (total >= 0 AND base_imponible >= 0 AND iva_importe >= 0),
            CONSTRAINT chk_contab_factura_iva_porcentaje 
                CHECK (iva_porcentaje >= 0 AND iva_porcentaje <= 100),
            CONSTRAINT chk_contab_factura_pagado 
                CHECK (total_pagado >= 0 AND total_pagado <= total)
        );

        CREATE INDEX IF NOT EXISTS idx_contab_factura_tenant_fecha 
            ON contabilidad_factura(id_tenant, fecha_devengo DESC) 
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_contab_factura_tenant_estado 
            ON contabilidad_factura(id_tenant, estado) 
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_contab_factura_tenant_tipo 
            ON contabilidad_factura(id_tenant, tipo) 
            WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_contab_factura_trimestre 
            ON contabilidad_factura(
                id_tenant, 
                EXTRACT(YEAR FROM fecha_devengo), 
                EXTRACT(QUARTER FROM fecha_devengo)
            ) WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_contab_factura_contacto 
            ON contabilidad_factura(id_contacto) 
            WHERE id_contacto IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_contab_factura_vencimiento 
            ON contabilidad_factura(id_tenant, fecha_vencimiento) 
            WHERE estado = 'PENDIENTE' AND deleted_at IS NULL;

        COMMENT ON TABLE contabilidad_factura IS 'Facturas unificadas de ingresos y gastos para contabilidad';

        -- =====================================================
        -- 3. TABLA: contabilidad_factura_archivo
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contabilidad_factura_archivo (
            id              BIGSERIAL PRIMARY KEY,
            id_factura      BIGINT NOT NULL REFERENCES contabilidad_factura(id) ON DELETE CASCADE,
            file_url        TEXT NOT NULL,
            storage_key     TEXT,
            mime_type       TEXT,
            size_bytes      INTEGER,
            original_name   TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by      BIGINT REFERENCES usuario(id)
        );

        CREATE INDEX IF NOT EXISTS idx_contab_archivo_factura 
            ON contabilidad_factura_archivo(id_factura);

        COMMENT ON TABLE contabilidad_factura_archivo IS 'Archivos adjuntos a facturas (PDF, imágenes)';

        -- =====================================================
        -- 4. TABLA: contabilidad_pago
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contabilidad_pago (
            id              BIGSERIAL PRIMARY KEY,
            id_factura      BIGINT NOT NULL REFERENCES contabilidad_factura(id) ON DELETE CASCADE,
            fecha_pago      DATE NOT NULL,
            importe         NUMERIC(14,2) NOT NULL,
            metodo          TEXT,
            referencia      TEXT,
            notas           TEXT,
            id_movimiento_banco BIGINT,
            conciliado      BOOLEAN DEFAULT false,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by      BIGINT REFERENCES usuario(id),
            
            CONSTRAINT chk_contab_pago_importe CHECK (importe > 0)
        );

        CREATE INDEX IF NOT EXISTS idx_contab_pago_factura 
            ON contabilidad_pago(id_factura);

        CREATE INDEX IF NOT EXISTS idx_contab_pago_fecha 
            ON contabilidad_pago(fecha_pago DESC);

        COMMENT ON TABLE contabilidad_pago IS 'Pagos registrados contra facturas';

        -- =====================================================
        -- 5. TABLA: contabilidad_trimestre
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contabilidad_trimestre (
            id              BIGSERIAL PRIMARY KEY,
            id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            anio            INTEGER NOT NULL,
            trimestre       SMALLINT NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
            estado          TEXT NOT NULL DEFAULT 'ABIERTO' 
                            CHECK (estado IN ('ABIERTO', 'CERRADO', 'REABIERTO')),
            base_ingresos   NUMERIC(14,2) DEFAULT 0,
            iva_repercutido NUMERIC(14,2) DEFAULT 0,
            base_gastos     NUMERIC(14,2) DEFAULT 0,
            iva_soportado   NUMERIC(14,2) DEFAULT 0,
            resultado_iva   NUMERIC(14,2) DEFAULT 0,
            closed_at       TIMESTAMPTZ,
            closed_by       BIGINT REFERENCES usuario(id),
            reopened_at     TIMESTAMPTZ,
            reopened_by     BIGINT REFERENCES usuario(id),
            reopen_reason   TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            
            CONSTRAINT ux_contab_trimestre_tenant_anio_q 
                UNIQUE (id_tenant, anio, trimestre)
        );

        CREATE INDEX IF NOT EXISTS idx_contab_trimestre_tenant 
            ON contabilidad_trimestre(id_tenant, anio DESC, trimestre DESC);

        COMMENT ON TABLE contabilidad_trimestre IS 'Control de cierres trimestrales de IVA';

        -- =====================================================
        -- 6. FUNCIÓN: Obtener trimestre de una fecha
        -- =====================================================
        CREATE OR REPLACE FUNCTION get_quarter(fecha DATE)
        RETURNS INTEGER AS $$
        BEGIN
            RETURN EXTRACT(QUARTER FROM fecha)::INTEGER;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;

        -- =====================================================
        -- 7. FUNCIÓN: Calcular IVA con redondeo correcto
        -- =====================================================
        CREATE OR REPLACE FUNCTION calcular_iva(
            base NUMERIC(14,2), 
            porcentaje NUMERIC(5,2)
        ) RETURNS NUMERIC(14,2) AS $$
        BEGIN
            RETURN ROUND(base * (porcentaje / 100.0), 2);
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;

        -- =====================================================
        -- 8. TRIGGER: Actualizar estado de factura al pagar
        -- =====================================================
        CREATE OR REPLACE FUNCTION update_factura_estado_on_pago()
        RETURNS TRIGGER AS $$
        DECLARE
            v_total NUMERIC(14,2);
            v_total_pagado NUMERIC(14,2);
        BEGIN
            SELECT total, COALESCE(SUM(p.importe), 0)
            INTO v_total, v_total_pagado
            FROM contabilidad_factura f
            LEFT JOIN contabilidad_pago p ON p.id_factura = f.id
            WHERE f.id = NEW.id_factura
            GROUP BY f.id, f.total;
            
            UPDATE contabilidad_factura
            SET 
                total_pagado = v_total_pagado,
                estado = CASE 
                    WHEN v_total_pagado >= v_total THEN 'PAGADA'
                    WHEN v_total_pagado > 0 THEN 'PARCIAL'
                    ELSE estado
                END,
                updated_at = now()
            WHERE id = NEW.id_factura;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_update_factura_on_pago ON contabilidad_pago;
        CREATE TRIGGER trg_update_factura_on_pago
            AFTER INSERT OR UPDATE OR DELETE ON contabilidad_pago
            FOR EACH ROW
            EXECUTE FUNCTION update_factura_estado_on_pago();

        -- =====================================================
        -- 9. PERMISOS RBAC para contabilidad
        -- =====================================================
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.read') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Contabilidad Lectura', 'contabilidad.read', 'contabilidad', 
                        'Ver facturas, movimientos y reportes contables');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.write') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Contabilidad Escritura', 'contabilidad.write', 'contabilidad', 
                        'Crear y editar facturas, registrar pagos');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.approve') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Contabilidad Aprobar', 'contabilidad.approve', 'contabilidad', 
                        'Cerrar trimestres, anular facturas');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.admin') THEN
                INSERT INTO permiso (nombre, key, module, descripcion)
                VALUES ('Contabilidad Admin', 'contabilidad.admin', 'contabilidad', 
                        'Configurar categorías, reabrir trimestres, exportar');
            END IF;
        END $$;
    `);

    console.log('[Migration] ✅ Contabilidad V3 tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping contabilidad V3 tables...');

    await knex.raw(`
        DROP TRIGGER IF EXISTS trg_update_factura_on_pago ON contabilidad_pago;
        DROP FUNCTION IF EXISTS update_factura_estado_on_pago();
        DROP FUNCTION IF EXISTS calcular_iva(NUMERIC, NUMERIC);
        DROP FUNCTION IF EXISTS get_quarter(DATE);
        DROP TABLE IF EXISTS contabilidad_trimestre CASCADE;
        DROP TABLE IF EXISTS contabilidad_pago CASCADE;
        DROP TABLE IF EXISTS contabilidad_factura_archivo CASCADE;
        DROP TABLE IF EXISTS contabilidad_factura CASCADE;
        DROP TABLE IF EXISTS contabilidad_contacto CASCADE;
        
        -- Note: Permissions are not removed to avoid breaking RBAC
    `);

    console.log('[Migration] ✅ Contabilidad V3 tables dropped');
};

exports.config = { transaction: true };
