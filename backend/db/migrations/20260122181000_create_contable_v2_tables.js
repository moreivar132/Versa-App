/**
 * Migration: create_contable_v2_tables
 * Source: backend/archive/legacy-migrations/create_contable_v2_tables.sql
 * Module: FinSaaS
 * Risk Level: Alto
 * 
 * Creates accounting V2 module tables:
 * - contable_category: income/expense categories
 * - contable_bill: received invoices
 * - contable_bill_line: bill line items
 * - Alterations to facturacabecera and cajamovimiento
 * - RBAC permissions for contable module
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating contable V2 tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: contable_category
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contable_category (
            id          BIGSERIAL PRIMARY KEY,
            id_tenant   BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            codigo      TEXT NOT NULL,
            nombre      TEXT NOT NULL,
            descripcion TEXT,
            tipo        TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
            activo      BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by  BIGINT REFERENCES usuario(id),
            
            CONSTRAINT ux_category_tenant_codigo UNIQUE (id_tenant, codigo)
        );

        CREATE INDEX IF NOT EXISTS idx_category_tenant_tipo 
            ON contable_category(id_tenant, tipo) 
            WHERE activo = true;

        COMMENT ON TABLE contable_category IS 'Categorías contables de ingreso/gasto por tenant';

        -- Insertar categorías por defecto para tenants existentes
        DO $$
        DECLARE
            t_id BIGINT;
        BEGIN
            FOR t_id IN SELECT id FROM tenant LOOP
                INSERT INTO contable_category (id_tenant, codigo, nombre, tipo)
                VALUES 
                    (t_id, 'ING_VENTA', 'Ventas', 'INGRESO'),
                    (t_id, 'ING_SERVICIO', 'Servicios', 'INGRESO'),
                    (t_id, 'ING_OTRO', 'Otros ingresos', 'INGRESO'),
                    (t_id, 'GAS_REPUESTOS', 'Repuestos', 'GASTO'),
                    (t_id, 'GAS_COMBUSTIBLE', 'Combustible', 'GASTO'),
                    (t_id, 'GAS_NOMINAS', 'Nóminas', 'GASTO'),
                    (t_id, 'GAS_ALQUILER', 'Alquiler', 'GASTO'),
                    (t_id, 'GAS_SUMINISTROS', 'Suministros', 'GASTO'),
                    (t_id, 'GAS_OTRO', 'Otros gastos', 'GASTO')
                ON CONFLICT (id_tenant, codigo) DO NOTHING;
            END LOOP;
        END $$;

        -- =====================================================
        -- 2. TABLA: contable_bill (facturas recibidas)
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contable_bill (
            id              BIGSERIAL PRIMARY KEY,
            id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            id_sucursal     BIGINT NOT NULL REFERENCES sucursal(id),
            id_proveedor    BIGINT NOT NULL REFERENCES proveedor(id),
            numero_factura  TEXT NOT NULL,
            fecha_emision   DATE NOT NULL,
            fecha_recepcion DATE NOT NULL DEFAULT current_date,
            fecha_vencimiento DATE,
            base_imponible  NUMERIC(14,2) NOT NULL DEFAULT 0,
            importe_iva     NUMERIC(14,2) NOT NULL DEFAULT 0,
            total           NUMERIC(14,2) NOT NULL DEFAULT 0,
            estado          TEXT NOT NULL DEFAULT 'PENDIENTE' 
                            CHECK (estado IN ('PENDIENTE', 'PAGADA', 'PARCIAL', 'ANULADA')),
            pdf_url         TEXT,
            observaciones   TEXT,
            id_compra       BIGINT REFERENCES compracabecera(id),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by      BIGINT NOT NULL REFERENCES usuario(id),
            updated_at      TIMESTAMPTZ,
            updated_by      BIGINT REFERENCES usuario(id),
            
            CONSTRAINT ux_bill_tenant_proveedor_numero 
                UNIQUE (id_tenant, id_proveedor, numero_factura),
            CONSTRAINT chk_bill_totales 
                CHECK (total >= 0 AND base_imponible >= 0 AND importe_iva >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_bill_tenant_fecha 
            ON contable_bill(id_tenant, fecha_emision DESC);
        CREATE INDEX IF NOT EXISTS idx_bill_tenant_estado 
            ON contable_bill(id_tenant, estado);
        CREATE INDEX IF NOT EXISTS idx_bill_proveedor 
            ON contable_bill(id_proveedor);

        COMMENT ON TABLE contable_bill IS 'Facturas recibidas de proveedores';

        -- =====================================================
        -- 3. TABLA: contable_bill_line
        -- =====================================================
        CREATE TABLE IF NOT EXISTS contable_bill_line (
            id              BIGSERIAL PRIMARY KEY,
            id_bill         BIGINT NOT NULL REFERENCES contable_bill(id) ON DELETE CASCADE,
            descripcion     TEXT NOT NULL,
            cantidad        NUMERIC(12,3) NOT NULL DEFAULT 1,
            precio_unitario NUMERIC(14,4) NOT NULL,
            iva_pct         NUMERIC(5,2) NOT NULL DEFAULT 21,
            base_imponible  NUMERIC(14,2) NOT NULL,
            importe_iva     NUMERIC(14,2) NOT NULL,
            total_linea     NUMERIC(14,2) NOT NULL,
            id_categoria    BIGINT REFERENCES contable_category(id),
            posicion        SMALLINT NOT NULL,
            
            CONSTRAINT chk_bill_line_totales 
                CHECK (total_linea >= 0 AND base_imponible >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_bill_line_bill 
            ON contable_bill_line(id_bill);

        COMMENT ON TABLE contable_bill_line IS 'Líneas de detalle de facturas recibidas';

        -- =====================================================
        -- 4. ALTERACIONES: Añadir columnas a tablas existentes
        -- =====================================================
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'facturacabecera' AND column_name = 'id_tenant'
            ) THEN
                ALTER TABLE facturacabecera 
                ADD COLUMN id_tenant BIGINT REFERENCES tenant(id);
                
                UPDATE facturacabecera fc 
                SET id_tenant = s.id_tenant 
                FROM sucursal s 
                WHERE fc.id_sucursal = s.id AND fc.id_tenant IS NULL;
                
                CREATE INDEX IF NOT EXISTS idx_factura_tenant_fecha 
                    ON facturacabecera(id_tenant, fecha_emision DESC);
            END IF;
        END $$;

        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'cajamovimiento' AND column_name = 'id_categoria'
            ) THEN
                ALTER TABLE cajamovimiento 
                ADD COLUMN id_categoria BIGINT REFERENCES contable_category(id);
            END IF;
        END $$;

        -- =====================================================
        -- 5. PERMISOS RBAC
        -- =====================================================
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES 
            ('CONTABLE_READ', 'contable.read', 'contable', 'Ver facturas, movimientos y reportes contables'),
            ('CONTABLE_WRITE', 'contable.write', 'contable', 'Crear y editar borradores, registrar movimientos'),
            ('CONTABLE_APPROVE', 'contable.approve', 'contable', 'Emitir facturas, anular, cerrar caja'),
            ('CONTABLE_EXPORT', 'contable.export', 'contable', 'Exportar reportes CSV/XLS'),
            ('CONTABLE_ADMIN', 'contable.admin', 'contable', 'Configurar series, plantillas, categorías')
        ON CONFLICT DO NOTHING;
    `);

    console.log('[Migration] ✅ Contable V2 tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping contable V2 tables...');

    await knex.raw(`
        -- Drop permissions (risky in production, commenting out)
        -- DELETE FROM permiso WHERE key IN ('contable.read','contable.write','contable.approve','contable.export','contable.admin');

        -- Rollback column alterations (risky, commenting out)
        -- ALTER TABLE cajamovimiento DROP COLUMN IF EXISTS id_categoria;
        -- ALTER TABLE facturacabecera DROP COLUMN IF EXISTS id_tenant;
        
        DROP TABLE IF EXISTS contable_bill_line CASCADE;
        DROP TABLE IF EXISTS contable_bill CASCADE;
        DROP TABLE IF EXISTS contable_category CASCADE;
    `);

    console.log('[Migration] ⚠️ Contable V2 tables dropped (column alterations preserved)');
};

exports.config = { transaction: true };
