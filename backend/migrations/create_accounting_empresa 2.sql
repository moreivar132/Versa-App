-- =====================================================
-- MIGRACIÓN: Multi-Empresa Contabilidad V2
-- Descripción: Estructura multi-empresa para gestorías
--              y autónomos con múltiples sociedades
-- Fecha: 2026-01-13
-- Compatibilidad: Aditiva (no rompe esquema existente)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLA: accounting_empresa
-- Empresa contable (entidad fiscal) dentro del tenant
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
    es_default      BOOLEAN DEFAULT false, -- Primera empresa del tenant
    created_at      TIMESTAMPTZ DEFAULT now(),
    created_by      BIGINT REFERENCES usuario(id),
    updated_at      TIMESTAMPTZ,
    updated_by      BIGINT REFERENCES usuario(id),
    deleted_at      TIMESTAMPTZ -- Soft delete
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_acc_empresa_tenant 
    ON accounting_empresa(id_tenant) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acc_empresa_activo 
    ON accounting_empresa(id_tenant, activo) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_acc_empresa_nif 
    ON accounting_empresa(id_tenant, nif_cif) WHERE deleted_at IS NULL;

COMMENT ON TABLE accounting_empresa IS 'Empresas contables (entidades fiscales) por tenant';

-- =====================================================
-- 2. TABLA: accounting_usuario_empresa
-- Asignación de usuarios a empresas (scoping)
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
-- Cuentas para gestión de tesorería (caja, banco, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_cuenta_tesoreria (
    id              BIGSERIAL PRIMARY KEY,
    id_empresa      BIGINT NOT NULL REFERENCES accounting_empresa(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    tipo            TEXT DEFAULT 'CAJA' CHECK (tipo IN ('CAJA', 'BANCO', 'PASARELA', 'OTRO')),
    entidad         TEXT, -- Nombre banco o pasarela
    numero_cuenta   TEXT, -- IBAN o número de cuenta
    saldo_actual    NUMERIC(14,2) DEFAULT 0,
    activo          BOOLEAN DEFAULT true,
    es_default      BOOLEAN DEFAULT false, -- Cuenta por defecto
    created_at      TIMESTAMPTZ DEFAULT now(),
    created_by      BIGINT REFERENCES usuario(id)
);

CREATE INDEX IF NOT EXISTS idx_acc_cuenta_empresa 
    ON accounting_cuenta_tesoreria(id_empresa) WHERE activo = true;

COMMENT ON TABLE accounting_cuenta_tesoreria IS 'Cuentas de tesorería (cajas, bancos, pasarelas)';

-- =====================================================
-- 4. MODIFICAR TABLAS EXISTENTES: Añadir id_empresa
-- =====================================================

-- Añadir columna a contabilidad_factura
ALTER TABLE contabilidad_factura 
    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);

-- Añadir columna a contabilidad_contacto
ALTER TABLE contabilidad_contacto 
    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);

-- Añadir columna a contabilidad_trimestre
ALTER TABLE contabilidad_trimestre 
    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);

-- Actualizar constraint de tipo en contactos para incluir AMBOS
ALTER TABLE contabilidad_contacto DROP CONSTRAINT IF EXISTS contabilidad_contacto_tipo_check;
ALTER TABLE contabilidad_contacto ADD CONSTRAINT contabilidad_contacto_tipo_check 
    CHECK (tipo IN ('PROVEEDOR', 'CLIENTE', 'AMBOS'));

-- Añadir campos adicionales a contactos
ALTER TABLE contabilidad_contacto 
    ADD COLUMN IF NOT EXISTS condiciones_pago INTEGER DEFAULT 30;
ALTER TABLE contabilidad_contacto 
    ADD COLUMN IF NOT EXISTS iban TEXT;

-- Índices por empresa
CREATE INDEX IF NOT EXISTS idx_contab_factura_empresa 
    ON contabilidad_factura(id_empresa) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contab_contacto_empresa 
    ON contabilidad_contacto(id_empresa) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contab_trimestre_empresa 
    ON contabilidad_trimestre(id_empresa);

-- =====================================================
-- 5. TABLA: accounting_transaccion
-- Registro unificado de cobros, pagos e ingresos efectivo
-- =====================================================
CREATE TABLE IF NOT EXISTS accounting_transaccion (
    id                  BIGSERIAL PRIMARY KEY,
    id_empresa          BIGINT NOT NULL REFERENCES accounting_empresa(id) ON DELETE CASCADE,
    id_cuenta           BIGINT REFERENCES accounting_cuenta_tesoreria(id),
    id_factura          BIGINT REFERENCES contabilidad_factura(id), -- NULL para ingresos manuales
    id_contacto         BIGINT REFERENCES contabilidad_contacto(id),
    tipo                TEXT NOT NULL CHECK (tipo IN ('COBRO', 'PAGO', 'INGRESO_EFECTIVO', 'AJUSTE')),
    fecha               DATE NOT NULL,
    importe             NUMERIC(14,2) NOT NULL,
    metodo              TEXT CHECK (metodo IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION', 'OTRO')),
    referencia          TEXT,
    concepto            TEXT,
    -- Flags para inclusión en reportes
    incluye_en_resultados BOOLEAN DEFAULT true,
    incluye_en_iva      BOOLEAN DEFAULT true,
    -- Conciliación bancaria (futuro)
    id_movimiento_banco BIGINT,
    conciliado          BOOLEAN DEFAULT false,
    fecha_conciliacion  TIMESTAMPTZ,
    -- Auditoría
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
-- 6. PERMISOS RBAC: Nuevos permisos empresa
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.empresa.read') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Empresas Lectura', 'contabilidad.empresa.read', 'contabilidad', 
                'Ver empresas contables del tenant');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.empresa.write') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Empresas Escritura', 'contabilidad.empresa.write', 'contabilidad', 
                'Crear y editar empresas contables');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.tesoreria.read') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Tesorería Lectura', 'contabilidad.tesoreria.read', 'contabilidad', 
                'Ver cuentas y movimientos de tesorería');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM permiso WHERE key = 'contabilidad.tesoreria.write') THEN
        INSERT INTO permiso (nombre, key, module, descripcion)
        VALUES ('Tesorería Escritura', 'contabilidad.tesoreria.write', 'contabilidad', 
                'Registrar cobros, pagos e ingresos');
    END IF;
END $$;

-- =====================================================
-- 7. MIGRAR DATOS EXISTENTES: Crear empresa default
-- =====================================================
DO $$
DECLARE
    t RECORD;
    new_empresa_id BIGINT;
BEGIN
    -- Para cada tenant que tenga facturas o contactos sin empresa
    FOR t IN 
        SELECT DISTINCT id_tenant FROM contabilidad_factura WHERE id_empresa IS NULL
        UNION
        SELECT DISTINCT id_tenant FROM contabilidad_contacto WHERE id_empresa IS NULL
    LOOP
        -- Verificar si ya tiene empresa default
        SELECT id INTO new_empresa_id 
        FROM accounting_empresa 
        WHERE id_tenant = t.id_tenant AND es_default = true
        LIMIT 1;
        
        -- Si no existe, crear una
        IF new_empresa_id IS NULL THEN
            INSERT INTO accounting_empresa (
                id_tenant, nombre_legal, nif_cif, es_default
            ) VALUES (
                t.id_tenant, 
                'Empresa Principal', 
                'PENDIENTE-' || t.id_tenant, 
                true
            )
            RETURNING id INTO new_empresa_id;
            
            -- Crear cuenta caja por defecto
            INSERT INTO accounting_cuenta_tesoreria (
                id_empresa, nombre, tipo, es_default
            ) VALUES (
                new_empresa_id, 'Caja Principal', 'CAJA', true
            );
        END IF;
        
        -- Asignar empresa a facturas huérfanas
        UPDATE contabilidad_factura 
        SET id_empresa = new_empresa_id 
        WHERE id_tenant = t.id_tenant AND id_empresa IS NULL;
        
        -- Asignar empresa a contactos huérfanos
        UPDATE contabilidad_contacto 
        SET id_empresa = new_empresa_id 
        WHERE id_tenant = t.id_tenant AND id_empresa IS NULL;
        
        -- Asignar empresa a trimestres huérfanos
        UPDATE contabilidad_trimestre 
        SET id_empresa = new_empresa_id 
        WHERE id_tenant = t.id_tenant AND id_empresa IS NULL;
    END LOOP;
END $$;

COMMIT;

-- =====================================================
-- ✅ FIN DE MIGRACIÓN
-- =====================================================
