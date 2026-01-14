/**
 * RBAC Roles Seed
 * Creates system roles with permission mappings
 * Matches the hierarchy defined in the implementation plan
 */

const pool = require('../db');

// Role definitions with their permission mappings
const SYSTEM_ROLES = [
    // ================================================================
    // GLOBAL SCOPE ROLES
    // ================================================================
    {
        name: 'SUPER_ADMIN',
        display_name: 'Super Administrador',
        scope: 'global',
        tenant_id: null,
        level: 0,
        is_system: true,
        // Super admin gets ALL permissions - handled separately
        permissions: ['*']
    },

    // ================================================================
    // TENANT SCOPE ROLES
    // ================================================================
    {
        name: 'TENANT_ADMIN',
        display_name: 'Administrador del Taller',
        scope: 'tenant',
        level: 10,
        is_system: true,
        permissions: [
            // Access management
            'access.manage', 'users.view', 'users.create', 'users.update', 'users.delete',
            'roles.view', 'roles.create', 'roles.update', 'roles.delete',
            'permissions.view', 'audit.view',
            // Full operations
            'appointments.view', 'appointments.create', 'appointments.update', 'appointments.delete',
            'workorders.view', 'workorders.create', 'workorders.update', 'workorders.delete',
            'workorders.assign', 'workorders.update_status', 'workorders.add_notes',
            'customers.view', 'customers.create', 'customers.update', 'customers.delete',
            'vehicles.view', 'vehicles.create', 'vehicles.update', 'vehicles.delete',
            'services.manage',
            // Full inventory
            'inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete',
            'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
            'purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete',
            // Full finance
            'invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete',
            'payments.view', 'payments.create', 'payments.update', 'payments.delete',
            'reports.view', 'reports.export',
            'cashregister.view', 'cashregister.manage',
            // Extra modules
            'marketplace.view', 'marketplace.manage',
            'marketing.view', 'marketing.manage',
            'loyalty.view', 'loyalty.manage',
            'config.view', 'config.manage'
        ]
    },
    {
        name: 'OPERATIONS_MANAGER',
        display_name: 'Jefe de Operaciones',
        scope: 'tenant',
        level: 20,
        is_system: true,
        permissions: [
            // Full appointments
            'appointments.view', 'appointments.create', 'appointments.update', 'appointments.delete',
            // Full workorders except delete
            'workorders.view', 'workorders.create', 'workorders.update', 'workorders.delete',
            'workorders.assign', 'workorders.update_status', 'workorders.add_notes',
            // Customer/vehicle management
            'customers.view', 'customers.create', 'customers.update',
            'vehicles.view', 'vehicles.create', 'vehicles.update',
            'services.manage',
            // View inventory
            'inventory.view',
            // Reports
            'reports.view'
        ]
    },
    {
        name: 'RECEPCIONISTA',
        display_name: 'Recepcionista',
        scope: 'tenant',
        level: 30,
        is_system: true,
        permissions: [
            // Appointments - create/update only
            'appointments.view', 'appointments.create', 'appointments.update',
            // Workorders - create/view only
            'workorders.view', 'workorders.create',
            // Customer/vehicle - create/update only
            'customers.view', 'customers.create', 'customers.update',
            'vehicles.view', 'vehicles.create', 'vehicles.update',
            // No delete permissions
            // No finance permissions
            // No access management
        ]
    },
    {
        name: 'MECHANIC',
        display_name: 'Mecánico',
        scope: 'tenant',
        level: 40,
        is_system: true,
        permissions: [
            // Workorders - view, create, update status/notes only
            'workorders.view',
            'workorders.create',
            'workorders.update_status',
            'workorders.add_notes',
            // View inventory only
            'inventory.view',
            // View appointments
            'appointments.view'
            // NO: workorders.update, workorders.delete
            // NO: access.*, users.*, roles.*
            // NO: finance permissions
        ]
    },
    {
        name: 'INVENTORY_MANAGER',
        display_name: 'Jefe de Almacén',
        scope: 'tenant',
        level: 50,
        is_system: true,
        permissions: [
            // Full inventory
            'inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete',
            // Full suppliers
            'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
            // Full purchases
            'purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete',
            // View workorders for context
            'workorders.view'
        ]
    },
    {
        name: 'ACCOUNTING',
        display_name: 'Contabilidad',
        scope: 'tenant',
        level: 60,
        is_system: true,
        permissions: [
            // Full invoices
            'invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete',
            // Full payments
            'payments.view', 'payments.create', 'payments.update', 'payments.delete',
            // Reports
            'reports.view', 'reports.export',
            // Cash register
            'cashregister.view', 'cashregister.manage',
            // View customers for reference
            'customers.view',
            // View purchases for reconciliation
            'purchases.view'
        ]
    },
    {
        name: 'FLEET_MANAGER',
        display_name: 'Jefe de Flota',
        scope: 'tenant',
        level: 70,
        is_system: true,
        permissions: [
            // Full fleet
            'fleet.view', 'fleet.create', 'fleet.update', 'fleet.delete',
            // Full contracts
            'contracts.view', 'contracts.create', 'contracts.update', 'contracts.delete',
            // GPS
            'gps.view',
            // Vehicles
            'vehicles.view', 'vehicles.update'
        ]
    },
    {
        name: 'VIEWER',
        display_name: 'Solo Lectura',
        scope: 'tenant',
        level: 99,
        is_system: true,
        permissions: [
            // All view permissions only
            'appointments.view',
            'workorders.view',
            'customers.view',
            'vehicles.view',
            'inventory.view',
            'suppliers.view',
            'purchases.view',
            'invoices.view',
            'payments.view',
            'reports.view',
            'cashregister.view',
            'marketplace.view',
            'loyalty.view'
        ]
    }
];

async function seedRoles() {
    console.log('🚀 Starting roles seed...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let rolesCreated = 0;
        let rolesUpdated = 0;
        let permissionsAssigned = 0;

        for (const roleDef of SYSTEM_ROLES) {
            console.log(`📌 Processing role: ${roleDef.name}`);

            // Check if role exists
            const existing = await client.query(
                `SELECT id FROM rol WHERE nombre = $1 AND (tenant_id IS NULL OR tenant_id = $2)`,
                [roleDef.name, roleDef.tenant_id]
            );

            let roleId;

            if (existing.rows.length > 0) {
                // Update existing role
                roleId = existing.rows[0].id;
                await client.query(`
                    UPDATE rol SET 
                        display_name = $1,
                        scope = $2,
                        level = $3,
                        is_system = $4,
                        updated_at = NOW()
                    WHERE id = $5
                `, [roleDef.display_name, roleDef.scope, roleDef.level, roleDef.is_system, roleId]);
                rolesUpdated++;
                console.log(`   ✏️  Updated role (id: ${roleId})`);
            } else {
                // Create new role
                const result = await client.query(`
                    INSERT INTO rol (nombre, display_name, scope, tenant_id, level, is_system)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [roleDef.name, roleDef.display_name, roleDef.scope, roleDef.tenant_id, roleDef.level, roleDef.is_system]);
                roleId = result.rows[0].id;
                rolesCreated++;
                console.log(`   ✅ Created role (id: ${roleId})`);
            }

            // Assign permissions
            if (roleDef.permissions.includes('*')) {
                // Super admin - assign all permissions
                const allPerms = await client.query('SELECT id FROM permiso');
                for (const perm of allPerms.rows) {
                    await client.query(`
                        INSERT INTO rolpermiso (id_rol, id_permiso)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [roleId, perm.id]);
                    permissionsAssigned++;
                }
                console.log(`   🔑 Assigned ALL permissions (${allPerms.rows.length})`);
            } else {
                // Assign specific permissions
                for (const permKey of roleDef.permissions) {
                    const perm = await client.query(
                        'SELECT id FROM permiso WHERE key = $1 OR nombre = $1',
                        [permKey]
                    );
                    if (perm.rows.length > 0) {
                        await client.query(`
                            INSERT INTO rolpermiso (id_rol, id_permiso)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING
                        `, [roleId, perm.rows[0].id]);
                        permissionsAssigned++;
                    } else {
                        console.log(`   ⚠️  Permission not found: ${permKey}`);
                    }
                }
                console.log(`   🔑 Assigned ${roleDef.permissions.length} permissions`);
            }
        }

        await client.query('COMMIT');

        console.log('\n✅ Roles seed completed!\n');
        console.log('📊 Results:');
        console.log(`   - Roles created: ${rolesCreated}`);
        console.log(`   - Roles updated: ${rolesUpdated}`);
        console.log(`   - Total permission assignments: ${permissionsAssigned}`);

        // Show role summary
        console.log('\n📋 System roles hierarchy:');
        const roles = await pool.query('SELECT nombre, display_name, scope, level FROM rol WHERE is_system = true ORDER BY level');
        for (const r of roles.rows) {
            console.log(`   Lv.${String(r.level).padStart(2, '0')} [${r.scope}] ${r.nombre} - "${r.display_name}"`);
        }

        console.log('\n✨ RBAC system setup complete!');
        console.log('\n📢 Next steps:');
        console.log('   1. Create a super admin user if not exists');
        console.log('   2. Deploy backend RBAC middleware');
        console.log('   3. Integrate manager-admin-accesos.html page');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seedRoles();
