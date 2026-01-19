/**
 * Migration: create_rbac_tables
 * Source: backend/migrations/create_rbac_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Enhances the existing RBAC system with multi-tenant capabilities:
 * - Adds scope, tenant_id, level columns to rol table
 * - Adds module, key columns to permiso table
 * - Creates audit_logs table
 * - Creates user_has_permission helper function
 */

exports.up = async function (knex) {
    console.log('[Migration] Enhancing RBAC tables for multi-tenant...');

    await knex.raw(`
        -- ================================================================
        -- 1. ENHANCE ROL TABLE (add multi-tenant columns)
        -- ================================================================
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'tenant';
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE;
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 50;
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE rol ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

        -- ================================================================
        -- 2. ENHANCE PERMISO TABLE
        -- ================================================================
        DO $$ 
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'permiso' AND column_name = 'nombre') THEN
                ALTER TABLE permiso ADD COLUMN IF NOT EXISTS key VARCHAR(100);
                UPDATE permiso SET key = nombre WHERE key IS NULL;
            END IF;
        END $$;

        ALTER TABLE permiso ADD COLUMN IF NOT EXISTS module VARCHAR(100);
        ALTER TABLE permiso ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

        -- ================================================================
        -- 3. ENHANCE USUARIOROL TABLE
        -- ================================================================
        ALTER TABLE usuariorol ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE;
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

        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

        -- ================================================================
        -- 5. UNIQUE CONSTRAINTS AND INDEXES
        -- ================================================================
        CREATE UNIQUE INDEX IF NOT EXISTS idx_rol_global_unique 
        ON rol(nombre) WHERE tenant_id IS NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_rol_tenant_unique 
        ON rol(tenant_id, nombre) WHERE tenant_id IS NOT NULL;

        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_permiso_key_unique') THEN
                CREATE UNIQUE INDEX idx_permiso_key_unique ON permiso(key) WHERE key IS NOT NULL;
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_permiso_module ON permiso(module);

        -- ================================================================
        -- 6. ENSURE is_super_admin EXISTS ON USUARIO
        -- ================================================================
        ALTER TABLE usuario ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

        -- ================================================================
        -- 7. HELPER FUNCTION FOR PERMISSION CHECK
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
            SELECT is_super_admin INTO is_super FROM usuario WHERE id = p_user_id;
            IF is_super THEN
                RETURN TRUE;
            END IF;
            
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
    `);

    console.log('[Migration] ✅ RBAC tables enhanced');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Reverting RBAC enhancements...');

    await knex.raw(`
        DROP FUNCTION IF EXISTS user_has_permission(INTEGER, INTEGER, VARCHAR);
        DROP INDEX IF EXISTS idx_permiso_module;
        DROP INDEX IF EXISTS idx_permiso_key_unique;
        DROP INDEX IF EXISTS idx_rol_tenant_unique;
        DROP INDEX IF EXISTS idx_rol_global_unique;
        DROP TABLE IF EXISTS audit_logs CASCADE;
        
        -- Note: Column drops are risky, marking as no-op for safety
        -- ALTER TABLE usuariorol DROP COLUMN IF EXISTS assigned_at;
        -- ALTER TABLE usuariorol DROP COLUMN IF EXISTS tenant_id;
        -- etc.
    `);

    console.log('[Migration] ⚠️ RBAC tables reverted (columns preserved for safety)');
};

exports.config = { transaction: true };
