/**
 * Migration: fix_admin_permissions_all
 * Source: backend/archive/legacy-migrations/fix_admin_permissions_all.sql
 * Module: Core/Shared
 * Risk Level: Bajo
 * 
 * Grants ALL core permissions to Administrador roles.
 * This is a data migration (seed) that ensures Admins have complete access.
 */

exports.up = async function (knex) {
    console.log('[Migration] Granting all permissions to Administrador roles...');

    await knex.raw(`
        -- Grant ALL core permissions to existing 'Administrador' roles
        INSERT INTO rolpermiso (id_rol, id_permiso)
        SELECT r.id, p.id
        FROM rol r
        CROSS JOIN permiso p
        WHERE r.nombre = 'Administrador'
          AND NOT EXISTS (
              SELECT 1 FROM rolpermiso rp 
              WHERE rp.id_rol = r.id AND rp.id_permiso = p.id
          );
    `);

    console.log('[Migration] ✅ All permissions granted to Administrador roles');
};

exports.down = async function (knex) {
    console.log('[Migration] ⚠️ Data migration - cannot be safely reversed');
    // This is a data migration that grants permissions
    // Reversing would remove critical admin access - NOT SAFE
    // Manual intervention required if rollback needed
    return Promise.resolve();
};

exports.config = { transaction: true };
