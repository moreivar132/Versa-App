/**
 * RBAC Permissions Seed
 * Populates the permissions catalog with all required permissions
 * Format: module.resource.action
 */

const pool = require('../db');

// Permission catalog organized by module
const PERMISSIONS = [
    // ================================================================
    // ACCESS / SECURITY MODULE
    // ================================================================
    { key: 'access.manage', module: 'access', description: 'Manage access control (users, roles, permissions)' },
    { key: 'users.view', module: 'access', description: 'View users list' },
    { key: 'users.create', module: 'access', description: 'Create new users' },
    { key: 'users.update', module: 'access', description: 'Update existing users' },
    { key: 'users.delete', module: 'access', description: 'Delete users' },
    { key: 'roles.view', module: 'access', description: 'View roles list' },
    { key: 'roles.create', module: 'access', description: 'Create new roles' },
    { key: 'roles.update', module: 'access', description: 'Update existing roles' },
    { key: 'roles.delete', module: 'access', description: 'Delete roles' },
    { key: 'permissions.view', module: 'access', description: 'View permissions list' },
    { key: 'audit.view', module: 'access', description: 'View audit logs' },

    // ================================================================
    // APPOINTMENTS MODULE
    // ================================================================
    { key: 'appointments.view', module: 'appointments', description: 'View appointments' },
    { key: 'appointments.create', module: 'appointments', description: 'Create appointments' },
    { key: 'appointments.update', module: 'appointments', description: 'Update appointments' },
    { key: 'appointments.delete', module: 'appointments', description: 'Delete appointments' },

    // ================================================================
    // WORKORDERS MODULE
    // ================================================================
    { key: 'workorders.view', module: 'workorders', description: 'View work orders' },
    { key: 'workorders.create', module: 'workorders', description: 'Create work orders' },
    { key: 'workorders.update', module: 'workorders', description: 'Update work orders' },
    { key: 'workorders.delete', module: 'workorders', description: 'Delete work orders' },
    { key: 'workorders.assign', module: 'workorders', description: 'Assign work orders to technicians' },
    { key: 'workorders.update_status', module: 'workorders', description: 'Update work order status' },
    { key: 'workorders.add_notes', module: 'workorders', description: 'Add notes to work orders' },

    // ================================================================
    // CUSTOMERS MODULE
    // ================================================================
    { key: 'customers.view', module: 'customers', description: 'View customers' },
    { key: 'customers.create', module: 'customers', description: 'Create customers' },
    { key: 'customers.update', module: 'customers', description: 'Update customers' },
    { key: 'customers.delete', module: 'customers', description: 'Delete customers' },

    // ================================================================
    // VEHICLES MODULE
    // ================================================================
    { key: 'vehicles.view', module: 'vehicles', description: 'View vehicles' },
    { key: 'vehicles.create', module: 'vehicles', description: 'Create vehicles' },
    { key: 'vehicles.update', module: 'vehicles', description: 'Update vehicles' },
    { key: 'vehicles.delete', module: 'vehicles', description: 'Delete vehicles' },

    // ================================================================
    // SERVICES MODULE
    // ================================================================
    { key: 'services.manage', module: 'services', description: 'Manage services catalog' },

    // ================================================================
    // INVENTORY MODULE
    // ================================================================
    { key: 'inventory.view', module: 'inventory', description: 'View inventory' },
    { key: 'inventory.create', module: 'inventory', description: 'Create inventory items' },
    { key: 'inventory.update', module: 'inventory', description: 'Update inventory items' },
    { key: 'inventory.delete', module: 'inventory', description: 'Delete inventory items' },

    // ================================================================
    // SUPPLIERS MODULE
    // ================================================================
    { key: 'suppliers.view', module: 'suppliers', description: 'View suppliers' },
    { key: 'suppliers.create', module: 'suppliers', description: 'Create suppliers' },
    { key: 'suppliers.update', module: 'suppliers', description: 'Update suppliers' },
    { key: 'suppliers.delete', module: 'suppliers', description: 'Delete suppliers' },

    // ================================================================
    // PURCHASES MODULE
    // ================================================================
    { key: 'purchases.view', module: 'purchases', description: 'View purchases' },
    { key: 'purchases.create', module: 'purchases', description: 'Create purchases' },
    { key: 'purchases.update', module: 'purchases', description: 'Update purchases' },
    { key: 'purchases.delete', module: 'purchases', description: 'Delete purchases' },

    // ================================================================
    // INVOICES MODULE
    // ================================================================
    { key: 'invoices.view', module: 'invoices', description: 'View invoices' },
    { key: 'invoices.create', module: 'invoices', description: 'Create invoices' },
    { key: 'invoices.update', module: 'invoices', description: 'Update invoices' },
    { key: 'invoices.delete', module: 'invoices', description: 'Delete invoices' },

    // ================================================================
    // PAYMENTS MODULE
    // ================================================================
    { key: 'payments.view', module: 'payments', description: 'View payments' },
    { key: 'payments.create', module: 'payments', description: 'Record payments' },
    { key: 'payments.update', module: 'payments', description: 'Update payments' },
    { key: 'payments.delete', module: 'payments', description: 'Delete payments' },

    // ================================================================
    // REPORTS MODULE
    // ================================================================
    { key: 'reports.view', module: 'reports', description: 'View reports' },
    { key: 'reports.export', module: 'reports', description: 'Export reports' },

    // ================================================================
    // CASH REGISTER MODULE
    // ================================================================
    { key: 'cashregister.view', module: 'cashregister', description: 'View cash register' },
    { key: 'cashregister.manage', module: 'cashregister', description: 'Manage cash register operations' },

    // ================================================================
    // FLEET / RENTING MODULE
    // ================================================================
    { key: 'fleet.view', module: 'fleet', description: 'View fleet vehicles' },
    { key: 'fleet.create', module: 'fleet', description: 'Create fleet vehicles' },
    { key: 'fleet.update', module: 'fleet', description: 'Update fleet vehicles' },
    { key: 'fleet.delete', module: 'fleet', description: 'Delete fleet vehicles' },
    { key: 'contracts.view', module: 'fleet', description: 'View rental contracts' },
    { key: 'contracts.create', module: 'fleet', description: 'Create rental contracts' },
    { key: 'contracts.update', module: 'fleet', description: 'Update rental contracts' },
    { key: 'contracts.delete', module: 'fleet', description: 'Delete rental contracts' },
    { key: 'gps.view', module: 'fleet', description: 'View GPS tracking' },

    // ================================================================
    // MARKETPLACE MODULE
    // ================================================================
    { key: 'marketplace.view', module: 'marketplace', description: 'View marketplace' },
    { key: 'marketplace.manage', module: 'marketplace', description: 'Manage marketplace settings' },

    // ================================================================
    // MARKETING MODULE
    // ================================================================
    { key: 'marketing.view', module: 'marketing', description: 'View marketing campaigns' },
    { key: 'marketing.manage', module: 'marketing', description: 'Manage marketing campaigns' },

    // ================================================================
    // LOYALTY / FIDELIZATION MODULE
    // ================================================================
    { key: 'loyalty.view', module: 'loyalty', description: 'View loyalty programs' },
    { key: 'loyalty.manage', module: 'loyalty', description: 'Manage loyalty programs' },

    // ================================================================
    // CONFIGURATION MODULE
    // ================================================================
    { key: 'config.view', module: 'config', description: 'View configuration' },
    { key: 'config.manage', module: 'config', description: 'Manage configuration' },
];

async function seedPermissions() {
    console.log('🚀 Starting permissions seed...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const perm of PERMISSIONS) {
            // Check if permission already exists
            const existing = await client.query(
                `SELECT id, nombre, key FROM permiso WHERE key = $1 OR nombre = $1`,
                [perm.key]
            );

            if (existing.rows.length > 0) {
                // Update existing permission
                await client.query(
                    `UPDATE permiso SET key = $1, module = $2, descripcion = $3 WHERE id = $4`,
                    [perm.key, perm.module, perm.description, existing.rows[0].id]
                );
                updated++;
            } else {
                // Insert new permission
                await client.query(
                    `INSERT INTO permiso (nombre, key, module, descripcion) VALUES ($1, $1, $2, $3)`,
                    [perm.key, perm.module, perm.description]
                );
                created++;
            }
        }

        await client.query('COMMIT');

        console.log('✅ Permissions seed completed!\n');
        console.log(`📊 Results:`);
        console.log(`   - Created: ${created}`);
        console.log(`   - Updated: ${updated}`);
        console.log(`   - Total permissions: ${PERMISSIONS.length}`);

        // Show permissions by module
        console.log('\n📋 Permissions by module:');
        const moduleGroups = {};
        for (const p of PERMISSIONS) {
            moduleGroups[p.module] = (moduleGroups[p.module] || 0) + 1;
        }
        for (const [module, count] of Object.entries(moduleGroups)) {
            console.log(`   - ${module}: ${count}`);
        }

        console.log('\n📢 Next step: Run seed_rbac_roles.js to populate system roles');

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

seedPermissions();
