-- ================================================================
-- RBAC Multi-Tenant System Migration
-- ================================================================
-- This migration adds multi-tenant RBAC capabilities to the existing
-- role/permission system, including audit logging.
-- ================================================================

-- ================================================================
-- 1. ENHANCE ROL TABLE (add multi-tenant columns)
-- ================================================================

-- Add scope column: 'global' for cross-tenant roles, 'tenant' for tenant-specific
ALTER TABLE rol ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'tenant';

-- Add tenant_id for tenant-specific roles (NULL for global roles)
ALTER TABLE rol ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE;

-- Add level for role hierarchy (lower = more privileged)
ALTER TABLE rol ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 50;

-- Add is_system flag to protect seed roles from deletion
ALTER TABLE rol ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Add display_name for UI-friendly names
ALTER TABLE rol ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Add timestamps if not exist
ALTER TABLE rol ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE rol ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ================================================================
-- 2. ENHANCE PERMISO TABLE (add key format and module grouping)
-- ================================================================

-- Rename 'nombre' to 'key' if it exists (for new format: module.resource.action)
-- Note: This is done carefully to preserve existing data
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'permiso' AND column_name = 'nombre') THEN
        -- Add key column first
        ALTER TABLE permiso ADD COLUMN IF NOT EXISTS key VARCHAR(100);
        -- Copy data from nombre to key
        UPDATE permiso SET key = nombre WHERE key IS NULL;
    END IF;
END $$;

-- Add module column for grouping permissions in UI
ALTER TABLE permiso ADD COLUMN IF NOT EXISTS module VARCHAR(100);

-- Add created_at if not exists
ALTER TABLE permiso ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ================================================================
-- 3. ENHANCE USUARIOROL TABLE (add tenant scope)
-- ================================================================

-- Add tenant_id to user_roles for tenant-specific role assignments
ALTER TABLE usuariorol ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE;

-- Add assigned_at timestamp
ALTER TABLE usuariorol ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW();

-- ================================================================
-- 4. CREATE AUDIT_LOGS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
    tenant_id INTEGER REFERENCES tenant(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    before_json JSONB,
    after_json JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ================================================================
-- 5. ADD UNIQUE CONSTRAINTS AND INDEXES
-- ================================================================

-- Unique constraint for global roles (tenant_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rol_global_unique 
ON rol(nombre) WHERE tenant_id IS NULL;

-- Unique constraint for tenant-specific roles
CREATE UNIQUE INDEX IF NOT EXISTS idx_rol_tenant_unique 
ON rol(tenant_id, nombre) WHERE tenant_id IS NOT NULL;

-- Unique constraint for permission keys
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_permiso_key_unique') THEN
        CREATE UNIQUE INDEX idx_permiso_key_unique ON permiso(key) WHERE key IS NOT NULL;
    END IF;
END $$;

-- Index for permission module grouping
CREATE INDEX IF NOT EXISTS idx_permiso_module ON permiso(module);

-- ================================================================
-- 6. ENSURE is_super_admin EXISTS ON USUARIO
-- ================================================================

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- ================================================================
-- 7. CREATE HELPER FUNCTION FOR PERMISSION CHECK
-- ================================================================

CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id INTEGER,
    p_tenant_id INTEGER,
    p_permission_key VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    is_super BOOLEAN;
    has_perm BOOLEAN;
BEGIN
    -- Check if user is super admin
    SELECT is_super_admin INTO is_super FROM usuario WHERE id = p_user_id;
    IF is_super THEN
        RETURN TRUE;
    END IF;
    
    -- Check permissions through roles
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
    ) INTO has_perm;
    
    RETURN has_perm;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 8. MIGRATION COMPLETE
-- ================================================================
-- Run seeds next: seed_rbac_permissions.js and seed_rbac_roles.js
