/**
 * Migración: Habilitar Row Level Security (RLS) - FASE 1
 * 
 * Habilita RLS en las tablas críticas para aislamiento automático de tenant.
 * 
 * TABLAS AFECTADAS:
 * - clientefinal
 * - contabilidad_factura, contabilidad_contacto, contabilidad_trimestre
 * - contable_category, contable_bill
 * - venta, income_event
 * - sucursal, usuario
 * - marketplace_listing, fidelizacion_programa
 * - user_dashboard_prefs, email_config, facturaconfigtenant
 * 
 * @see docs/RLS_PLAN.md para detalles completos
 */

exports.up = async function (knex) {
    console.log('🔒 Habilitando Row Level Security (FASE 1)...');

    // 1. Crear funciones helper
    await knex.raw(`
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
  `);

    await knex.raw(`
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
  `);

    console.log('  ✓ Funciones helper creadas');

    // 2. Lista de tablas con id_tenant a proteger
    const tablesWithTenant = [
        'clientefinal',
        'contabilidad_factura',
        'contabilidad_contacto',
        'contabilidad_trimestre',
        'contable_category',
        'venta',
        'income_event',
        'sucursal',
        'usuario'
    ];

    // Tablas opcionales (pueden no existir)
    const optionalTables = [
        'contable_bill',
        'fidelizacion_programa',
        'marketplace_listing',
        'user_dashboard_prefs',
        'email_config',
        'facturaconfigtenant'
    ];

    // 3. Habilitar RLS en tablas principales
    for (const table of tablesWithTenant) {
        const exists = await knex.schema.hasTable(table);
        if (exists) {
            await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
            await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
            await knex.raw(`DROP POLICY IF EXISTS rls_tenant_${table} ON ${table}`);

            // Policy especial para usuario (permite id_tenant NULL para super admins)
            if (table === 'usuario') {
                await knex.raw(`
          CREATE POLICY rls_tenant_${table} ON ${table}
          FOR ALL TO PUBLIC
          USING (
            app_is_superadmin() = true 
            OR id_tenant = app_current_tenant()
            OR id_tenant IS NULL
          )
          WITH CHECK (
            app_is_superadmin() = true 
            OR id_tenant = app_current_tenant()
            OR id_tenant IS NULL
          )
        `);
            } else {
                await knex.raw(`
          CREATE POLICY rls_tenant_${table} ON ${table}
          FOR ALL TO PUBLIC
          USING (
            app_is_superadmin() = true 
            OR id_tenant = app_current_tenant()
          )
          WITH CHECK (
            app_is_superadmin() = true 
            OR id_tenant = app_current_tenant()
          )
        `);
            }
            console.log(`  ✓ RLS habilitado en ${table}`);
        } else {
            console.log(`  ⚠ Tabla ${table} no existe, saltando...`);
        }
    }

    // 4. Habilitar RLS en tablas opcionales
    for (const table of optionalTables) {
        const exists = await knex.schema.hasTable(table);
        if (exists) {
            await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
            await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
            await knex.raw(`DROP POLICY IF EXISTS rls_tenant_${table} ON ${table}`);
            await knex.raw(`
        CREATE POLICY rls_tenant_${table} ON ${table}
        FOR ALL TO PUBLIC
        USING (app_is_superadmin() = true OR id_tenant = app_current_tenant())
        WITH CHECK (app_is_superadmin() = true OR id_tenant = app_current_tenant())
      `);
            console.log(`  ✓ RLS habilitado en ${table}`);
        }
    }

    console.log('✅ RLS FASE 1 completado');
};

exports.down = async function (knex) {
    console.log('🔓 Deshabilitando Row Level Security...');

    const allTables = [
        'clientefinal',
        'contabilidad_factura',
        'contabilidad_contacto',
        'contabilidad_trimestre',
        'contable_category',
        'contable_bill',
        'venta',
        'income_event',
        'sucursal',
        'usuario',
        'fidelizacion_programa',
        'marketplace_listing',
        'user_dashboard_prefs',
        'email_config',
        'facturaconfigtenant'
    ];

    for (const table of allTables) {
        const exists = await knex.schema.hasTable(table);
        if (exists) {
            await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
            await knex.raw(`DROP POLICY IF EXISTS rls_tenant_${table} ON ${table}`);
            console.log(`  ✓ RLS deshabilitado en ${table}`);
        }
    }

    // No eliminamos las funciones helper (podrían usarse en otros lugares)
    console.log('⚠️  Funciones app_current_tenant() y app_is_superadmin() mantenidas');
    console.log('✅ Rollback RLS completado');
};
