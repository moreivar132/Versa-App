-- =====================================================
-- SCRIPT DE EMERGENCIA: Desactivar RLS
-- Descripción: Deshabilita RLS en todas las tablas 
--              en caso de problemas en producción
-- USO: SOLO EN EMERGENCIA - ejecutar manualmente
-- Fecha: 2026-01-13
-- =====================================================

-- IMPORTANTE: Ejecutar este script requiere permisos de superusuario
-- o rol con ALTER TABLE privileges

BEGIN;

-- =====================================================
-- PASO 1: Desactivar RLS en tablas FASE 1
-- =====================================================

-- clientefinal
ALTER TABLE clientefinal DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_clientefinal ON clientefinal;

-- contabilidad_factura
ALTER TABLE contabilidad_factura DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_contabilidad_factura ON contabilidad_factura;

-- contabilidad_contacto
ALTER TABLE contabilidad_contacto DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_contabilidad_contacto ON contabilidad_contacto;

-- contabilidad_trimestre
ALTER TABLE contabilidad_trimestre DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_contabilidad_trimestre ON contabilidad_trimestre;

-- contable_category
ALTER TABLE contable_category DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_contable_category ON contable_category;

-- venta
ALTER TABLE venta DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_venta ON venta;

-- income_event
ALTER TABLE income_event DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_income_event ON income_event;

-- sucursal
ALTER TABLE sucursal DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_sucursal ON sucursal;

-- usuario
ALTER TABLE usuario DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_usuario ON usuario;

-- =====================================================
-- PASO 2: Desactivar RLS en tablas adicionales
-- =====================================================

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contable_bill') THEN
        ALTER TABLE contable_bill DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS rls_tenant_contable_bill ON contable_bill;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fidelizacion_programa') THEN
        ALTER TABLE fidelizacion_programa DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS rls_tenant_fidelizacion_programa ON fidelizacion_programa;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketplace_listing') THEN
        ALTER TABLE marketplace_listing DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS rls_tenant_marketplace_listing ON marketplace_listing;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_dashboard_prefs') THEN
        ALTER TABLE user_dashboard_prefs DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS rls_tenant_user_dashboard_prefs ON user_dashboard_prefs;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_config') THEN
        ALTER TABLE email_config DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS rls_tenant_email_config ON email_config;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facturaconfigtenant') THEN
        ALTER TABLE facturaconfigtenant DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS rls_tenant_facturaconfigtenant ON facturaconfigtenant;
    END IF;
END $$;

-- =====================================================
-- PASO 3: Verificación
-- =====================================================
DO $$
DECLARE
    tabla RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS DESACTIVADO - Estado actual:';
    RAISE NOTICE '========================================';
    
    FOR tabla IN 
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        IF tabla.rowsecurity = true THEN
            RAISE WARNING 'ADVERTENCIA: RLS aún activo en: %', tabla.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Rollback de RLS completado.';
    RAISE NOTICE 'ADVERTENCIA: El sistema ahora depende solo de WHERE clauses manuales.';
    RAISE NOTICE '';
END $$;

COMMIT;

-- =====================================================
-- NOTAS:
-- 1. Las funciones app_current_tenant() y app_is_superadmin() 
--    se mantienen para no romper código que las use.
-- 2. Para reactivar RLS, ejecutar enable_rls_phase1.sql
-- 3. Notificar inmediatamente al equipo de desarrollo
-- =====================================================
