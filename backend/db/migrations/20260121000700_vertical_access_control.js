/**
 * Migration: Vertical Access Control
 * @description Adds vertical-based access control for Manager, SaaS, and Marketplace
 */

exports.up = async function (knex) {
    // 1. Create vertical catalog table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS vertical (
            id SERIAL PRIMARY KEY,
            key VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            display_order INTEGER DEFAULT 0,
            icon VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_vertical_key ON vertical(key);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_vertical_active ON vertical(is_active);`);

    // 2. Create tenant-vertical relationship table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS tenant_vertical (
            tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            vertical_id INTEGER NOT NULL REFERENCES vertical(id) ON DELETE CASCADE,
            is_enabled BOOLEAN DEFAULT true,
            enabled_at TIMESTAMPTZ DEFAULT NOW(),
            disabled_at TIMESTAMPTZ,
            notes TEXT,
            PRIMARY KEY (tenant_id, vertical_id)
        );
    `);

    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_vertical_tenant ON tenant_vertical(tenant_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_vertical_vertical ON tenant_vertical(vertical_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_tenant_vertical_enabled ON tenant_vertical(is_enabled) WHERE is_enabled = true;`);

    // 3. Add vertical_id to permiso table
    await knex.raw(`ALTER TABLE permiso ADD COLUMN IF NOT EXISTS vertical_id INTEGER REFERENCES vertical(id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_permiso_vertical ON permiso(vertical_id);`);

    // 4. Create user permission overrides table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS user_permission_override (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
            tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            permission_id INTEGER NOT NULL REFERENCES permiso(id) ON DELETE CASCADE,
            effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
            reason TEXT,
            created_by INTEGER REFERENCES usuario(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            UNIQUE (user_id, tenant_id, permission_id)
        );
    `);

    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_user_perm_override_user ON user_permission_override(user_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_user_perm_override_tenant ON user_permission_override(tenant_id);`);
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_user_perm_override_effect ON user_permission_override(effect);`);

    // 5. Seed default verticals
    await knex.raw(`
        INSERT INTO vertical (key, name, description, display_order, icon) VALUES
            ('manager', 'Manager', 'Vertical de operación de taller: órdenes de trabajo, citas, inventario, clientes, vehículos', 1, 'fa-wrench'),
            ('saas', 'Contable', 'Módulo contable: facturación, impuestos, pagos, reportes financieros', 2, 'fa-file-invoice-dollar'),
            ('marketplace', 'Marketplace', 'Plataforma de publicación y venta de servicios', 3, 'fa-store')
        ON CONFLICT (key) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            display_order = EXCLUDED.display_order,
            icon = EXCLUDED.icon,
            updated_at = NOW();
    `);

    // 6. Create user_has_permission function
    await knex.raw(`
        CREATE OR REPLACE FUNCTION user_has_permission(
            p_user_id INTEGER,
            p_tenant_id INTEGER,
            p_permission_key VARCHAR
        ) RETURNS BOOLEAN AS $$
        DECLARE
            is_super BOOLEAN;
            has_deny BOOLEAN;
            has_allow BOOLEAN;
            has_role_perm BOOLEAN;
            perm_vertical_id INTEGER;
            vertical_enabled BOOLEAN;
        BEGIN
            SELECT is_super_admin INTO is_super FROM usuario WHERE id = p_user_id;
            IF is_super THEN RETURN TRUE; END IF;
            
            SELECT p.vertical_id INTO perm_vertical_id FROM permiso p
            WHERE p.key = p_permission_key OR p.nombre = p_permission_key LIMIT 1;
            
            IF perm_vertical_id IS NOT NULL THEN
                SELECT tv.is_enabled INTO vertical_enabled FROM tenant_vertical tv
                WHERE tv.tenant_id = p_tenant_id AND tv.vertical_id = perm_vertical_id;
                IF vertical_enabled IS NULL OR vertical_enabled = FALSE THEN RETURN FALSE; END IF;
            END IF;
            
            SELECT EXISTS (
                SELECT 1 FROM user_permission_override upo
                JOIN permiso p ON p.id = upo.permission_id
                WHERE upo.user_id = p_user_id AND upo.tenant_id = p_tenant_id AND upo.effect = 'deny'
                  AND (p.key = p_permission_key OR p.nombre = p_permission_key)
                  AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
            ) INTO has_deny;
            IF has_deny THEN RETURN FALSE; END IF;
            
            SELECT EXISTS (
                SELECT 1 FROM user_permission_override upo
                JOIN permiso p ON p.id = upo.permission_id
                WHERE upo.user_id = p_user_id AND upo.tenant_id = p_tenant_id AND upo.effect = 'allow'
                  AND (p.key = p_permission_key OR p.nombre = p_permission_key)
                  AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
            ) INTO has_allow;
            IF has_allow THEN RETURN TRUE; END IF;
            
            SELECT EXISTS (
                SELECT 1 FROM usuariorol ur
                JOIN rol r ON ur.id_rol = r.id
                JOIN rolpermiso rp ON rp.id_rol = r.id
                JOIN permiso p ON p.id = rp.id_permiso
                WHERE ur.id_usuario = p_user_id
                  AND (p.key = p_permission_key OR p.nombre = p_permission_key)
                  AND (r.scope = 'global' OR (r.scope = 'tenant' AND r.tenant_id = p_tenant_id) OR (ur.tenant_id = p_tenant_id))
            ) INTO has_role_perm;
            
            RETURN has_role_perm;
        END;
        $$ LANGUAGE plpgsql;
    `);

    // 7. Create helper functions
    await knex.raw(`
        CREATE OR REPLACE FUNCTION tenant_has_vertical(p_tenant_id INTEGER, p_vertical_key VARCHAR) RETURNS BOOLEAN AS $$
        DECLARE result BOOLEAN;
        BEGIN
            SELECT tv.is_enabled INTO result FROM tenant_vertical tv
            JOIN vertical v ON v.id = tv.vertical_id
            WHERE tv.tenant_id = p_tenant_id AND v.key = p_vertical_key;
            RETURN COALESCE(result, FALSE);
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION user_can_access_vertical(p_user_id INTEGER, p_tenant_id INTEGER, p_vertical_key VARCHAR) RETURNS BOOLEAN AS $$
        DECLARE is_super BOOLEAN; vertical_enabled BOOLEAN;
        BEGIN
            SELECT is_super_admin INTO is_super FROM usuario WHERE id = p_user_id;
            IF is_super THEN RETURN TRUE; END IF;
            SELECT tv.is_enabled INTO vertical_enabled FROM tenant_vertical tv
            JOIN vertical v ON v.id = tv.vertical_id
            WHERE tv.tenant_id = p_tenant_id AND v.key = p_vertical_key;
            RETURN COALESCE(vertical_enabled, FALSE);
        END;
        $$ LANGUAGE plpgsql;
    `);
};

exports.down = async function (knex) {
    await knex.raw(`DROP FUNCTION IF EXISTS user_can_access_vertical(INTEGER, INTEGER, VARCHAR);`);
    await knex.raw(`DROP FUNCTION IF EXISTS tenant_has_vertical(INTEGER, VARCHAR);`);
    await knex.raw(`DROP FUNCTION IF EXISTS user_has_permission(INTEGER, INTEGER, VARCHAR);`);
    await knex.raw(`DROP TABLE IF EXISTS user_permission_override CASCADE;`);
    await knex.raw(`ALTER TABLE permiso DROP COLUMN IF EXISTS vertical_id;`);
    await knex.raw(`DROP TABLE IF EXISTS tenant_vertical CASCADE;`);
    await knex.raw(`DROP TABLE IF EXISTS vertical CASCADE;`);
};

exports.config = { transaction: true };
