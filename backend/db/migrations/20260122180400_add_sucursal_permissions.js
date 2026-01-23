/**
 * Migration: add_sucursal_permissions
 * Source: backend/archive/legacy-migrations/add_sucursal_permissions.sql
 * Module: Core/Shared
 * Risk Level: Bajo
 * 
 * Adds RBAC permissions for Sucursales module and grants them to Administrador role.
 */

exports.up = async function (knex) {
    console.log('[Migration] Adding Sucursal permissions...');

    await knex.raw(`
        -- Add permissions for Sucursales module
        INSERT INTO permiso (nombre, key, module, descripcion, created_at)
        SELECT * FROM (VALUES 
            ('sucursales.view', 'sucursales.view', 'sucursales', 'View branches list', NOW()),
            ('sucursales.manage', 'sucursales.manage', 'sucursales', 'Create, update and delete branches', NOW())
        ) AS v(nombre, key, module, descripcion, created_at)
        WHERE NOT EXISTS (
            SELECT 1 FROM permiso p WHERE p.key = v.key
        );

        -- Grant these permissions to all existing 'Administrador' roles
        INSERT INTO rolpermiso (id_rol, id_permiso)
        SELECT r.id, p.id
        FROM rol r
        CROSS JOIN permiso p
        WHERE r.nombre = 'Administrador'
          AND p.key IN ('sucursales.view', 'sucursales.manage')
          AND NOT EXISTS (
              SELECT 1 FROM rolpermiso rp 
              WHERE rp.id_rol = r.id AND rp.id_permiso = p.id
          );
    `);

    console.log('[Migration] ✅ Sucursal permissions added');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Data migration - cannot be safely reversed');
    // Data migrations (INSERT into rolpermiso) are not safely reversible
    // The permissions can be manually removed if needed
    return Promise.resolve();
};

exports.config = { transaction: true };
