/**
 * RBAC Sync Service
 * 
 * Synchronizes the database state with `definitions.js`.
 * - Upserts Permissions (Robust: Handles missing UNIQUE constraints)
 * - Removes obsolete Permissions (Cleanup)
 * - Upserts System Roles
 * - Synchronizes Role-Permission assignments
 */

const pool = require('../../../db'); // Adjust path as needed
const { PERMISSIONS, ROLES, VERTICALS } = require('./definitions');

async function syncRBAC(options = { cleanup: true }) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('🔄 Starting RBAC Sync...');

        // =============================================================
        // 1. SYNC PERMISSIONS
        // =============================================================
        console.log('📦 Syncing Permissions...');

        for (const p of PERMISSIONS) {
            // Check existence
            const res = await client.query('SELECT id FROM permiso WHERE key = $1', [p.key]);

            if (res.rows.length === 0) {
                // INSERT
                await client.query(
                    `INSERT INTO permiso (nombre, key, module, vertical_id) VALUES ($1, $2, $3, $4)`,
                    [p.nombre, p.key, p.module, p.vertical_id]
                );
            } else if (res.rows.length === 1) {
                // UPDATE
                await client.query(
                    `UPDATE permiso SET nombre = $1, module = $2, vertical_id = $3 WHERE id = $4`,
                    [p.nombre, p.module, p.vertical_id, res.rows[0].id]
                );
            } else {
                // DUPLICATES FOUND (>1)
                console.warn(`⚠️  Found duplicate permissions for key: ${p.key}. Cleaning up...`);
                const ids = res.rows.map(r => r.id);
                const survivorId = ids[0];
                const toDelete = ids.slice(1);

                // Update survivor
                await client.query(
                    `UPDATE permiso SET nombre = $1, module = $2, vertical_id = $3 WHERE id = $4`,
                    [p.nombre, p.module, p.vertical_id, survivorId]
                );

                // Delete duplicates (might fail if foreign keys exist pointing to them)
                // If FK exists, we should reassign them to survivor? 
                // For simplicity, we try to DELETE. If it fails, we might need a migration for cleaning.
                // But rolpermiso usage of duplicates is the issue.

                // Reassign rolpermiso from duplicates to survivor
                await client.query(
                    `UPDATE rolpermiso SET id_permiso = $1 WHERE id_permiso = ANY($2)
                     AND id_rol NOT IN (SELECT id_rol FROM rolpermiso WHERE id_permiso = $1)`, // Prevent unique violation
                    [survivorId, toDelete]
                );
                // Delete remaining rolpermiso that would cause conflict (already exist on survivor)
                await client.query(
                    `DELETE FROM rolpermiso WHERE id_permiso = ANY($1)`,
                    [toDelete]
                );

                // Now safe to delete permissions
                await client.query(
                    `DELETE FROM permiso WHERE id = ANY($1)`,
                    [toDelete]
                );
            }
        }

        // 1.2 Cleanup obsolete permissions (If enabled)
        if (options.cleanup) {
            const validKeys = PERMISSIONS.map(p => p.key);
            if (validKeys.length > 0) {
                // Delete references in rolpermiso first
                const placeholders = validKeys.map((_, i) => `$${i + 1}`).join(',');

                await client.query(`
                    DELETE FROM rolpermiso 
                    WHERE id_permiso IN (
                        SELECT id FROM permiso WHERE key NOT IN (${placeholders})
                    )
                `, validKeys);

                const deleteQuery = `
                    DELETE FROM permiso 
                    WHERE key NOT IN (${placeholders})
                `;
                const res = await client.query(deleteQuery, validKeys);
                if (res.rowCount > 0) {
                    console.log(`🗑️  Deleted ${res.rowCount} obsolete permissions.`);
                }
            }
        }

        // =============================================================
        // 2. SYNC ROLES (System Roles Only)
        // =============================================================
        console.log('👥 Syncing System Roles...');

        for (const r of ROLES) {
            // Upsert Role (Using name as key, manually checking to avoid constraint issues if missing)
            // System roles typically identified by unique name globally or per tenant. 
            // Here 'tenant_id IS NULL' makes them system roles.

            const res = await client.query(
                `SELECT id FROM rol WHERE nombre = $1 AND tenant_id IS NULL`,
                [r.nombre]
            );

            let roleId;
            if (res.rows.length === 0) {
                const insertRes = await client.query(
                    `INSERT INTO rol (nombre, display_name, scope, is_system, level, tenant_id, updated_at)
                     VALUES ($1, $2, 'tenant', $3, $4, NULL, NOW()) RETURNING id`,
                    [r.nombre, r.display_name, r.is_system, r.level]
                );
                roleId = insertRes.rows[0].id;
            } else {
                roleId = res.rows[0].id;
                await client.query(
                    `UPDATE rol SET display_name = $1, is_system = $2, level = $3, updated_at = NOW()
                     WHERE id = $4`,
                    [r.display_name, r.is_system, r.level, roleId]
                );
            }

            // =============================================================
            // 3. SYNC ROLE-PERMISSIONS (Assignments)
            // =============================================================

            const requiredPermKeys = r.permissions;
            if (!requiredPermKeys || requiredPermKeys.length === 0) {
                // Clear all
                await client.query(`DELETE FROM rolpermiso WHERE id_rol = $1`, [roleId]);
                continue;
            }

            // Get IDs for keys
            const resPerms = await client.query(
                `SELECT id FROM permiso WHERE key = ANY($1)`,
                [requiredPermKeys]
            );
            const requiredPermIds = resPerms.rows.map(row => row.id);

            // Sync Assignments

            // 1. Delete extras
            if (requiredPermIds.length > 0) {
                await client.query(
                    `DELETE FROM rolpermiso WHERE id_rol = $1 AND id_permiso != ALL($2)`,
                    [roleId, requiredPermIds]
                );
            } else {
                // If definition has permissions but they are not found in DB (unlikely if we just synced), do nothing or delete all?
                // Safest: Delete all current assignments if we found NO valid permissions to assign (empty list)
                await client.query(`DELETE FROM rolpermiso WHERE id_rol = $1`, [roleId]);
            }

            // 2. Insert missing
            if (requiredPermIds.length > 0) {
                await client.query(`
                    INSERT INTO rolpermiso (id_rol, id_permiso)
                    SELECT $1, p.id
                    FROM UNNEST($2::int[]) AS p(id)
                    WHERE NOT EXISTS (
                        SELECT 1 FROM rolpermiso rp WHERE rp.id_rol = $1 AND rp.id_permiso = p.id
                    )
                `, [roleId, requiredPermIds]);
            }
        }

        // 4. Cleanup obsolete System Roles (If enabled and no users assigned)
        if (options.cleanup) {
            const validRoleNames = ROLES.map(r => r.nombre);
            const obsoleteRolesRes = await client.query(`
                SELECT id, nombre FROM rol 
                WHERE tenant_id IS NULL 
                AND nombre != ALL($1)
            `, [validRoleNames]);

            for (const row of obsoleteRolesRes.rows) {
                // Check if role has users
                const userCountRes = await client.query(
                    'SELECT COUNT(*) FROM usuariorol WHERE id_rol = $1',
                    [row.id]
                );

                if (parseInt(userCountRes.rows[0].count) === 0) {
                    // Safe to delete assignments first (just in case)
                    await client.query('DELETE FROM rolpermiso WHERE id_rol = $1', [row.id]);
                    // Delete role
                    await client.query('DELETE FROM rol WHERE id = $1', [row.id]);
                    console.log(`🗑️  Deleted unused legacy role: ${row.nombre}`);
                } else {
                    console.warn(`⚠️  Cannot delete legacy role ${row.nombre}: it has ${userCountRes.rows[0].count} users assigned.`);
                }
            }
        }

        await client.query('COMMIT');
        console.log('✅ RBAC Sync Complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ RBAC Sync Failed:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Allow direct execution
if (require.main === module) {
    require('dotenv').config();
    syncRBAC()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { syncRBAC };
