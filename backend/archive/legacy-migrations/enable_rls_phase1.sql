-- =====================================================
-- MIGRACIÓN: Row Level Security (RLS) - FASE 1
-- Descripción: Habilita RLS en tablas críticas y crea 
--              funciones helper para aislamiento de tenant
-- Fecha: 2026-01-13
-- Compatibilidad: PostgreSQL 12+
-- IMPORTANTE: Ejecutar en una ventana de bajo tráfico
-- =====================================================

-- =====================================================
-- PASO 1: Crear funciones helper para acceso al contexto
-- =====================================================

-- Función para obtener el tenant_id actual del contexto
CREATE OR REPLACE FUNCTION app_current_tenant() 
RETURNS BIGINT AS $$
DECLARE
    tenant_val TEXT;
BEGIN
    tenant_val := current_setting('app.tenant_id', true);
    IF tenant_val IS NULL OR tenant_val = '' THEN
        RETURN NULL;
    END IF;
    RETURN tenant_val::BIGINT;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION app_current_tenant() IS 
'Retorna el tenant_id del contexto actual. NULL si no está seteado o es super-admin.';

-- Función para verificar si el contexto actual es super-admin
CREATE OR REPLACE FUNCTION app_is_superadmin() 
RETURNS BOOLEAN AS $$
DECLARE
    superadmin_val TEXT;
BEGIN
    superadmin_val := current_setting('app.is_superadmin', true);
    RETURN COALESCE(superadmin_val, 'false')::BOOLEAN;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION app_is_superadmin() IS 
'Retorna true si el contexto actual es super-admin (bypass de RLS).';

-- =====================================================
-- PASO 2: Habilitar RLS en tablas CRÍTICAS (FASE 1)
-- =====================================================

-- Lista de tablas a proteger en FASE 1:
-- 1. clientefinal (datos de clientes)
-- 2. contabilidad_factura (facturas contables)
-- 3. contabilidad_contacto (contactos fiscales)
-- 4. contabilidad_trimestre (cierres IVA)
-- 5. contable_category (categorías contables)
-- 6. venta (ventas directas)
-- 7. income_event (eventos de ingreso)
-- 8. sucursal (sucursales)
-- 9. usuario (usuarios del sistema)

-- =====================================================
-- 2.1 TABLA: clientefinal
-- =====================================================
ALTER TABLE clientefinal ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientefinal FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_clientefinal ON clientefinal;
CREATE POLICY rls_tenant_clientefinal ON clientefinal
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

COMMENT ON POLICY rls_tenant_clientefinal ON clientefinal IS 
'Aislamiento de tenant: solo acceso a rows del tenant actual o super-admin.';

-- =====================================================
-- 2.2 TABLA: contabilidad_factura
-- =====================================================
ALTER TABLE contabilidad_factura ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad_factura FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_contabilidad_factura ON contabilidad_factura;
CREATE POLICY rls_tenant_contabilidad_factura ON contabilidad_factura
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.3 TABLA: contabilidad_contacto
-- =====================================================
ALTER TABLE contabilidad_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad_contacto FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_contabilidad_contacto ON contabilidad_contacto;
CREATE POLICY rls_tenant_contabilidad_contacto ON contabilidad_contacto
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.4 TABLA: contabilidad_trimestre
-- =====================================================
ALTER TABLE contabilidad_trimestre ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad_trimestre FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_contabilidad_trimestre ON contabilidad_trimestre;
CREATE POLICY rls_tenant_contabilidad_trimestre ON contabilidad_trimestre
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.5 TABLA: contable_category
-- =====================================================
ALTER TABLE contable_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE contable_category FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_contable_category ON contable_category;
CREATE POLICY rls_tenant_contable_category ON contable_category
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.6 TABLA: venta
-- =====================================================
ALTER TABLE venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_venta ON venta;
CREATE POLICY rls_tenant_venta ON venta
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.7 TABLA: income_event
-- =====================================================
ALTER TABLE income_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_event FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_income_event ON income_event;
CREATE POLICY rls_tenant_income_event ON income_event
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.8 TABLA: sucursal
-- =====================================================
ALTER TABLE sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursal FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_sucursal ON sucursal;
CREATE POLICY rls_tenant_sucursal ON sucursal
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
    );

-- =====================================================
-- 2.9 TABLA: usuario
-- =====================================================
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_usuario ON usuario;
CREATE POLICY rls_tenant_usuario ON usuario
    FOR ALL
    TO PUBLIC
    USING (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
        OR id_tenant IS NULL  -- Super admins without tenant
    )
    WITH CHECK (
        app_is_superadmin() = true 
        OR id_tenant = app_current_tenant()
        OR id_tenant IS NULL
    );

-- =====================================================
-- PASO 3: Tablas adicionales con id_tenant (prioridad media)
-- =====================================================

-- contable_bill
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contable_bill') THEN
        ALTER TABLE contable_bill ENABLE ROW LEVEL SECURITY;
        ALTER TABLE contable_bill FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS rls_tenant_contable_bill ON contable_bill;
        CREATE POLICY rls_tenant_contable_bill ON contable_bill
            FOR ALL TO PUBLIC
            USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
            WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant());
    END IF;
END $$;

-- fidelizacion_programa
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fidelizacion_programa') THEN
        ALTER TABLE fidelizacion_programa ENABLE ROW LEVEL SECURITY;
        ALTER TABLE fidelizacion_programa FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS rls_tenant_fidelizacion_programa ON fidelizacion_programa;
        CREATE POLICY rls_tenant_fidelizacion_programa ON fidelizacion_programa
            FOR ALL TO PUBLIC
            USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
            WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant());
    END IF;
END $$;

-- marketplace_listing
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketplace_listing') THEN
        ALTER TABLE marketplace_listing ENABLE ROW LEVEL SECURITY;
        ALTER TABLE marketplace_listing FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS rls_tenant_marketplace_listing ON marketplace_listing;
        CREATE POLICY rls_tenant_marketplace_listing ON marketplace_listing
            FOR ALL TO PUBLIC
            USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
            WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant());
    END IF;
END $$;

-- user_dashboard_prefs
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_dashboard_prefs') THEN
        ALTER TABLE user_dashboard_prefs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_dashboard_prefs FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS rls_tenant_user_dashboard_prefs ON user_dashboard_prefs;
        CREATE POLICY rls_tenant_user_dashboard_prefs ON user_dashboard_prefs
            FOR ALL TO PUBLIC
            USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
            WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant());
    END IF;
END $$;

-- email_config
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_config') THEN
        ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;
        ALTER TABLE email_config FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS rls_tenant_email_config ON email_config;
        CREATE POLICY rls_tenant_email_config ON email_config
            FOR ALL TO PUBLIC
            USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
            WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant());
    END IF;
END $$;

-- facturaconfigtenant
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facturaconfigtenant') THEN
        ALTER TABLE facturaconfigtenant ENABLE ROW LEVEL SECURITY;
        ALTER TABLE facturaconfigtenant FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS rls_tenant_facturaconfigtenant ON facturaconfigtenant;
        CREATE POLICY rls_tenant_facturaconfigtenant ON facturaconfigtenant
            FOR ALL TO PUBLIC
            USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
            WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant());
    END IF;
END $$;

-- =====================================================
-- PASO 4: Verificación
-- =====================================================
DO $$
DECLARE
    tabla RECORD;
    count_rls INTEGER := 0;
BEGIN
    FOR tabla IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'clientefinal', 'contabilidad_factura', 'contabilidad_contacto',
            'contabilidad_trimestre', 'contable_category', 'venta',
            'income_event', 'sucursal', 'usuario'
        )
    LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = tabla.tablename 
            AND rowsecurity = true
        ) THEN
            count_rls := count_rls + 1;
            RAISE NOTICE 'RLS habilitado en: %', tabla.tablename;
        ELSE
            RAISE WARNING 'RLS NO habilitado en: %', tabla.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total tablas con RLS: %', count_rls;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- ✅ FIN DE MIGRACIÓN RLS FASE 1
-- =====================================================
