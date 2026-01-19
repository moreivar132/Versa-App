-- ================================================================
-- VERSA Vertical Access Control Migration
-- ================================================================
-- This migration adds vertical-based access control tables for
-- managing access to Manager, SaaS, and Marketplace verticals.
-- ================================================================

-- ================================================================
-- 1. VERTICAL CATALOG TABLE
-- ================================================================
-- Defines the available verticals in the system

CREATE TABLE IF NOT EXISTS vertical (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,  -- 'manager' | 'saas' | 'marketplace'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50),  -- icon class for UI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by key
CREATE INDEX IF NOT EXISTS idx_vertical_key ON vertical(key);
CREATE INDEX IF NOT EXISTS idx_vertical_active ON vertical(is_active);

-- ================================================================
-- 2. TENANT-VERTICAL RELATIONSHIP (Feature Gating)
-- ================================================================
-- Defines which verticals each tenant has access to (contracted)

CREATE TABLE IF NOT EXISTS tenant_vertical (
    tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    vertical_id INTEGER NOT NULL REFERENCES vertical(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    enabled_at TIMESTAMPTZ DEFAULT NOW(),
    disabled_at TIMESTAMPTZ,
    notes TEXT,  -- optional notes about the subscription
    PRIMARY KEY (tenant_id, vertical_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tenant_vertical_tenant ON tenant_vertical(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_vertical_vertical ON tenant_vertical(vertical_id);
CREATE INDEX IF NOT EXISTS idx_tenant_vertical_enabled ON tenant_vertical(is_enabled) WHERE is_enabled = true;

-- ================================================================
-- 3. ADD VERTICAL_ID TO PERMISO TABLE
-- ================================================================
-- Links permissions to their respective verticals

ALTER TABLE permiso ADD COLUMN IF NOT EXISTS vertical_id INTEGER REFERENCES vertical(id);

-- Index for vertical-based permission lookups
CREATE INDEX IF NOT EXISTS idx_permiso_vertical ON permiso(vertical_id);

-- ================================================================
-- 4. USER PERMISSION OVERRIDES
-- ================================================================
-- Allows per-user permission overrides (allow/deny exceptions)

CREATE TABLE IF NOT EXISTS user_permission_override (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permiso(id) ON DELETE CASCADE,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    reason TEXT,  -- optional: why this override exists
    created_by INTEGER REFERENCES usuario(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- optional: auto-expire overrides
    UNIQUE (user_id, tenant_id, permission_id)
);

-- Indexes for efficient override lookups
CREATE INDEX IF NOT EXISTS idx_user_perm_override_user ON user_permission_override(user_id);
CREATE INDEX IF NOT EXISTS idx_user_perm_override_tenant ON user_permission_override(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_perm_override_effect ON user_permission_override(effect);

-- ================================================================
-- 5. SEED DEFAULT VERTICALS
-- ================================================================

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

-- ================================================================
-- 6. UPDATE user_has_permission() FUNCTION
-- ================================================================
-- Enhanced version that respects vertical access and user overrides

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
    -- 1. Check if user is super admin (bypass all checks)
    SELECT is_super_admin INTO is_super FROM usuario WHERE id = p_user_id;
    IF is_super THEN
        RETURN TRUE;
    END IF;
    
    -- 2. Get the permission's vertical_id
    SELECT p.vertical_id INTO perm_vertical_id
    FROM permiso p
    WHERE p.key = p_permission_key OR p.nombre = p_permission_key
    LIMIT 1;
    
    -- 3. Check if vertical is enabled for tenant (if permission has vertical_id)
    IF perm_vertical_id IS NOT NULL THEN
        SELECT tv.is_enabled INTO vertical_enabled
        FROM tenant_vertical tv
        WHERE tv.tenant_id = p_tenant_id AND tv.vertical_id = perm_vertical_id;
        
        IF vertical_enabled IS NULL OR vertical_enabled = FALSE THEN
            RETURN FALSE;  -- Vertical not enabled for this tenant
        END IF;
    END IF;
    
    -- 4. Check for explicit DENY override (always takes precedence)
    SELECT EXISTS (
        SELECT 1
        FROM user_permission_override upo
        JOIN permiso p ON p.id = upo.permission_id
        WHERE upo.user_id = p_user_id
          AND upo.tenant_id = p_tenant_id
          AND upo.effect = 'deny'
          AND (p.key = p_permission_key OR p.nombre = p_permission_key)
          AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
    ) INTO has_deny;
    
    IF has_deny THEN
        RETURN FALSE;
    END IF;
    
    -- 5. Check for explicit ALLOW override
    SELECT EXISTS (
        SELECT 1
        FROM user_permission_override upo
        JOIN permiso p ON p.id = upo.permission_id
        WHERE upo.user_id = p_user_id
          AND upo.tenant_id = p_tenant_id
          AND upo.effect = 'allow'
          AND (p.key = p_permission_key OR p.nombre = p_permission_key)
          AND (upo.expires_at IS NULL OR upo.expires_at > NOW())
    ) INTO has_allow;
    
    IF has_allow THEN
        RETURN TRUE;
    END IF;
    
    -- 6. Check permissions through roles (original logic)
    SELECT EXISTS (
        SELECT 1 
        FROM usuariorol ur
        JOIN rol r ON ur.id_rol = r.id
        JOIN rolpermiso rp ON rp.id_rol = r.id
        JOIN permiso p ON p.id = rp.id_permiso
        WHERE ur.id_usuario = p_user_id
          AND (p.key = p_permission_key OR p.nombre = p_permission_key)
          AND (
              r.scope = 'global' 
              OR (r.scope = 'tenant' AND r.tenant_id = p_tenant_id)
              OR (ur.tenant_id = p_tenant_id)
          )
    ) INTO has_role_perm;
    
    RETURN has_role_perm;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 7. CREATE tenant_has_vertical() HELPER FUNCTION
-- ================================================================
-- Quick check if a tenant has access to a vertical

CREATE OR REPLACE FUNCTION tenant_has_vertical(
    p_tenant_id INTEGER,
    p_vertical_key VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN;
BEGIN
    SELECT tv.is_enabled INTO result
    FROM tenant_vertical tv
    JOIN vertical v ON v.id = tv.vertical_id
    WHERE tv.tenant_id = p_tenant_id AND v.key = p_vertical_key;
    
    RETURN COALESCE(result, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 8. CREATE user_can_access_vertical() HELPER FUNCTION
-- ================================================================
-- Full check: tenant has vertical AND user has at least one permission in it

CREATE OR REPLACE FUNCTION user_can_access_vertical(
    p_user_id INTEGER,
    p_tenant_id INTEGER,
    p_vertical_key VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    is_super BOOLEAN;
    vertical_enabled BOOLEAN;
BEGIN
    -- Super admin bypass
    SELECT is_super_admin INTO is_super FROM usuario WHERE id = p_user_id;
    IF is_super THEN
        RETURN TRUE;
    END IF;
    
    -- Check tenant has vertical enabled
    SELECT tv.is_enabled INTO vertical_enabled
    FROM tenant_vertical tv
    JOIN vertical v ON v.id = tv.vertical_id
    WHERE tv.tenant_id = p_tenant_id AND v.key = p_vertical_key;
    
    RETURN COALESCE(vertical_enabled, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Next step: Run seed_verticals.js to populate vertical-prefixed permissions
