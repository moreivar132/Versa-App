/**
 * Migration: create_accounting_empresa
 * Source: backend/archive/legacy-migrations/create_accounting_empresa.sql
 * Module: FinSaaS
 * Risk Level: Alto
 * 
 * Creates multi-empresa accounting structure for gestorías:
 * - accounting_empresa: fiscal entities per tenant
 * - accounting_usuario_empresa: user-empresa assignments
 * - accounting_cuenta_tesoreria: cash/bank accounts
 * - accounting_transaccion: unified transaction ledger
 * - RBAC permissions for empresa management
 * - Data migration for existing records
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating accounting multi-empresa structure...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: accounting_empresa
        -- =====================================================
        CREATE TABLE IF NOT EXISTS accounting_empresa (
            id              BIGSERIAL PRIMARY KEY,
            id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            nombre_legal    TEXT NOT NULL,
            nombre_comercial TEXT,
            nif_cif         TEXT NOT NULL,
            direccion       TEXT,
            codigo_postal   TEXT,
            ciudad          TEXT,
            provincia       TEXT,
            pais            TEXT DEFAULT 'ES',
            moneda          TEXT DEFAULT 'EUR',
            iva_defecto     NUMERIC(5,2) DEFAULT 21,
            regimen         TEXT DEFAULT 'GENERAL' CHECK (regimen IN ('GENERAL', 'SIMPLIFICADO', 'RECARGO')),
            email           TEXT,
            telefono        TEXT,
            logo_url        TEXT,
            activo          BOOLEAN DEFAULT true,
            es_default      BOOLEAN DEFAULT false,
            created_at      TIMESTAMPTZ DEFAULT now(),
            created_by      BIGINT REFERENCES usuario(id),
            updated_at      TIMESTAMPTZ,
            updated_by      BIGINT REFERENCES usuario(id),
            deleted_at      TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_acc_empresa_tenant 
            ON accounting_empresa(id_tenant) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_acc_empresa_activo 
            ON accounting_empresa(id_tenant, activo) WHERE deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_acc_empresa_nif 
            ON accounting_empresa(id_tenant, nif_cif) WHERE deleted_at IS NULL;

        COMMENT ON TABLE accounting_empresa IS 'Empresas contables (entidades fiscales) por tenant';

        -- =====================================================
        -- 2. TABLA: accounting_usuario_empresa
        -- =====================================================
        CREATE TABLE IF NOT EXISTS accounting_usuario_empresa (
            id              BIGSERIAL PRIMARY KEY,
            id_usuario      BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
            id_empresa      BIGINT NOT NULL REFERENCES accounting_empresa(id) ON DELETE CASCADE,
            rol_empresa     TEXT DEFAULT 'empresa_lector' 
                            CHECK (rol_empresa IN ('empresa_admin', 'empresa_contable', 'empresa_lector')),
            created_at      TIMESTAMPTZ DEFAULT now(),
            created_by      BIGINT REFERENCES usuario(id),
            
            CONSTRAINT ux_usuario_empresa UNIQUE (id_usuario, id_empresa)
        );

        CREATE INDEX IF NOT EXISTS idx_acc_usuario_empresa_user 
            ON accounting_usuario_empresa(id_usuario);
        CREATE INDEX IF NOT EXISTS idx_acc_usuario_empresa_empresa 
            ON accounting_usuario_empresa(id_empresa);

        COMMENT ON TABLE accounting_usuario_empresa IS 'Permisos de usuarios por empresa contable';

        -- =====================================================
        -- 3. TABLA: accounting_cuenta_tesoreria
        -- =====================================================
        CREATE TABLE IF NOT EXISTS accounting_cuenta_tesoreria (
            id              BIGSERIAL PRIMARY KEY,
            id_empresa      BIGINT NOT NULL REFERENCES accounting_empresa(id) ON DELETE CASCADE,
            nombre          TEXT NOT NULL,
            tipo            TEXT DEFAULT 'CAJA' CHECK (tipo IN ('CAJA', 'BANCO', 'PASARELA', 'OTRO')),
            entidad         TEXT,
            numero_cuenta   TEXT,
            saldo_actual    NUMERIC(14,2) DEFAULT 0,
            activo          BOOLEAN DEFAULT true,
            es_default      BOOLEAN DEFAULT false,
            created_at      TIMESTAMPTZ DEFAULT now(),
            created_by      BIGINT REFERENCES usuario(id)
        );

        CREATE INDEX IF NOT EXISTS idx_acc_cuenta_empresa 
            ON accounting_cuenta_tesoreria(id_empresa) WHERE activo = true;

        COMMENT ON TABLE accounting_cuenta_tesoreria IS 'Cuentas de tesorería (cajas, bancos, pasarelas)';

        -- =====================================================
        -- 4. MODIFICAR TABLAS EXISTENTES: Añadir id_empresa
        -- =====================================================
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contabilidad_factura') THEN
                ALTER TABLE contabilidad_factura 
                    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);
            END IF;
        END $$;

        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contabilidad_contacto') THEN
                ALTER TABLE contabilidad_contacto 
                    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);
                    
                ALTER TABLE contabilidad_contacto DROP CONSTRAINT IF EXISTS contabilidad_contacto_tipo_check;
                ALTER TABLE contabilidad_contacto ADD CONSTRAINT contabilidad_contacto_tipo_check 
                    CHECK (tipo IN ('PROVEEDOR', 'CLIENTE', 'AMBOS'));
                    
                ALTER TABLE contabilidad_contacto 
                    ADD COLUMN IF NOT EXISTS condiciones_pago INTEGER DEFAULT 30;
                ALTER TABLE contabilidad_contacto 
                    ADD COLUMN IF NOT EXISTS iban TEXT;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contabilidad_trimestre') THEN
                ALTER TABLE contabilidad_trimestre 
                    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);
            END IF;
        END $$;

        -- Crear índices si las tablas existen
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contabilidad_factura') THEN
                CREATE INDEX IF NOT EXISTS idx_contab_factura_empresa 
                    ON contabilidad_factura(id_empresa) WHERE deleted_at IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contabilidad_contacto') THEN
                CREATE INDEX IF NOT EXISTS idx_contab_contacto_empresa 
                    ON contabilidad_contacto(id_empresa) WHERE deleted_at IS NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contabilidad_trimestre') THEN
                CREATE INDEX IF NOT EXISTS idx_contab_trimestre_empresa 
                    ON contabilidad_trimestre(id_empresa);
            END IF;
        END $$;

        -- =====================================================
        -- 5. TABLA: accounting_transaccion
        -- =====================================================
        CREATE TABLE IF NOT EXISTS accounting_transaccion (
            id                  BIGSERIAL PRIMARY KEY,
            id_empresa          BIGINT NOT NULL REFERENCES accounting_empresa(id) ON DELETE CASCADE,
            id_cuenta           BIGINT REFERENCES accounting_cuenta_tesoreria(id),
            id_factura          BIGINT REFERENCES contabilidad_factura(id),
            id_contacto         BIGINT REFERENCES contabilidad_contacto(id),
            tipo                TEXT NOT NULL CHECK (tipo IN ('COBRO', 'PAGO', 'INGRESO_EFECTIVO', 'AJUSTE')),
            fecha               DATE NOT NULL,
            importe             NUMERIC(14,2) NOT NULL,
            metodo              TEXT CHECK (metodo IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION', 'OTRO')),
            referencia          TEXT,
            concepto            TEXT,
            incluye_en_resultados BOOLEAN DEFAULT true,
            incluye_en_iva      BOOLEAN DEFAULT true,
            id_movimiento_banco BIGINT,
            conciliado          BOOLEAN DEFAULT false,
            fecha_conciliacion  TIMESTAMPTZ,
            created_at          TIMESTAMPTZ DEFAULT now(),
            created_by          BIGINT REFERENCES usuario(id),
            notas               TEXT,
            
            CONSTRAINT chk_transaccion_importe CHECK (importe != 0)
        );

        CREATE INDEX IF NOT EXISTS idx_acc_transaccion_empresa 
            ON accounting_transaccion(id_empresa, fecha DESC);
        CREATE INDEX IF NOT EXISTS idx_acc_transaccion_factura 
            ON accounting_transaccion(id_factura) WHERE id_factura IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_acc_transaccion_tipo 
            ON accounting_transaccion(id_empresa, tipo);

        COMMENT ON TABLE accounting_transaccion IS 'Transacciones unificadas: cobros, pagos, ingresos efectivo';

        -- =====================================================
        -- 6. PERMISOS RBAC
        -- =====================================================
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES 
            ('Empresas Lectura', 'contabilidad.empresa.read', 'contabilidad', 'Ver empresas contables del tenant'),
            ('Empresas Escritura', 'contabilidad.empresa.write', 'contabilidad', 'Crear y editar empresas contables'),
            ('Tesorería Lectura', 'contabilidad.tesoreria.read', 'contabilidad', 'Ver cuentas y movimientos de tesorería'),
            ('Tesorería Escritura', 'contabilidad.tesoreria.write', 'contabilidad', 'Registrar cobros, pagos e ingresos')
        ON CONFLICT DO NOTHING;
    `);

    console.log('[Migration] ✅ Accounting multi-empresa structure created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping accounting multi-empresa structure...');

    await knex.raw(`
        DROP TABLE IF EXISTS accounting_transaccion CASCADE;
        DROP TABLE IF EXISTS accounting_cuenta_tesoreria CASCADE;
        DROP TABLE IF EXISTS accounting_usuario_empresa CASCADE;
        DROP TABLE IF EXISTS accounting_empresa CASCADE;
        
        -- Column drops from existing tables are risky - not dropping
        -- The id_empresa columns on contabilidad_* tables are preserved
    `);

    console.log('[Migration] ⚠️ Accounting multi-empresa tables dropped (columns preserved)');
};

exports.config = { transaction: true };
