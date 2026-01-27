/**
 * VERSA - Seed Verticals and Vertical-Prefixed Permissions
 * 
 * This script:
 * 1. Updates existing permissions with vertical_id
 * 2. Adds new vertical-prefixed permissions
 * 3. Updates role-permission mappings
 */

const pool = require('../db');

// ================================================================
// PERMISSION CATALOG BY VERTICAL
// ================================================================

const MANAGER_PERMISSIONS = [
    // Workorders
    { key: 'manager.workorders.view', module: 'workorders', description: 'View work orders' },
    { key: 'manager.workorders.create', module: 'workorders', description: 'Create work orders' },
    { key: 'manager.workorders.update', module: 'workorders', description: 'Update work orders' },
    { key: 'manager.workorders.delete', module: 'workorders', description: 'Delete work orders' },
    { key: 'manager.workorders.assign', module: 'workorders', description: 'Assign work orders to technicians' },
    { key: 'manager.workorders.update_status', module: 'workorders', description: 'Update work order status' },
    { key: 'manager.workorders.add_notes', module: 'workorders', description: 'Add notes to work orders' },

    // Appointments
    { key: 'manager.appointments.view', module: 'appointments', description: 'View appointments' },
    { key: 'manager.appointments.create', module: 'appointments', description: 'Create appointments' },
    { key: 'manager.appointments.update', module: 'appointments', description: 'Update appointments' },
    { key: 'manager.appointments.delete', module: 'appointments', description: 'Delete appointments' },

    // Customers
    { key: 'manager.customers.view', module: 'customers', description: 'View customers' },
    { key: 'manager.customers.create', module: 'customers', description: 'Create customers' },
    { key: 'manager.customers.update', module: 'customers', description: 'Update customers' },
    { key: 'manager.customers.delete', module: 'customers', description: 'Delete customers' },

    // Vehicles
    { key: 'manager.vehicles.view', module: 'vehicles', description: 'View vehicles' },
    { key: 'manager.vehicles.create', module: 'vehicles', description: 'Create vehicles' },
    { key: 'manager.vehicles.update', module: 'vehicles', description: 'Update vehicles' },
    { key: 'manager.vehicles.delete', module: 'vehicles', description: 'Delete vehicles' },

    // Inventory
    { key: 'manager.inventory.view', module: 'inventory', description: 'View inventory' },
    { key: 'manager.inventory.create', module: 'inventory', description: 'Create inventory items' },
    { key: 'manager.inventory.update', module: 'inventory', description: 'Update inventory items' },
    { key: 'manager.inventory.delete', module: 'inventory', description: 'Delete inventory items' },
    { key: 'manager.inventory.transfer', module: 'inventory', description: 'Transfer inventory between branches' },
    { key: 'manager.inventory.adjust', module: 'inventory', description: 'Adjust inventory quantities' },

    // Purchases
    { key: 'manager.purchases.view', module: 'purchases', description: 'View purchases' },
    { key: 'manager.purchases.create', module: 'purchases', description: 'Create purchases' },
    { key: 'manager.purchases.update', module: 'purchases', description: 'Update purchases' },
    { key: 'manager.purchases.delete', module: 'purchases', description: 'Delete purchases' },
    { key: 'manager.purchases.approve', module: 'purchases', description: 'Approve purchase orders' },

    // Cash Register
    { key: 'manager.cashregister.view', module: 'cashregister', description: 'View cash register' },
    { key: 'manager.cashregister.manage', module: 'cashregister', description: 'Manage cash operations' },
    { key: 'manager.cashregister.open', module: 'cashregister', description: 'Open cash register' },
    { key: 'manager.cashregister.close', module: 'cashregister', description: 'Close cash register' },

    // Branches
    { key: 'manager.branches.view', module: 'branches', description: 'View branches' },
    { key: 'manager.branches.view_all', module: 'branches', description: 'View all branches (admin)' },
    { key: 'manager.branches.manage', module: 'branches', description: 'Manage branches' },

    // Users & Roles (Manager-specific)
    { key: 'manager.users.view', module: 'users', description: 'View users' },
    { key: 'manager.users.manage', module: 'users', description: 'Manage users' },
    { key: 'manager.roles.view', module: 'roles', description: 'View roles' },
    { key: 'manager.roles.manage', module: 'roles', description: 'Manage roles' },

    // Reports
    { key: 'manager.reports.view', module: 'reports', description: 'View reports' },
    { key: 'manager.reports.export', module: 'reports', description: 'Export reports' },

    // Fleet/Renting
    { key: 'manager.fleet.view', module: 'fleet', description: 'View fleet vehicles' },
    { key: 'manager.fleet.manage', module: 'fleet', description: 'Manage fleet vehicles' },
    { key: 'manager.contracts.view', module: 'fleet', description: 'View rental contracts' },
    { key: 'manager.contracts.manage', module: 'fleet', description: 'Manage rental contracts' },

    // Marketing
    { key: 'manager.marketing.view', module: 'marketing', description: 'View marketing campaigns' },
    { key: 'manager.marketing.manage', module: 'marketing', description: 'Manage marketing campaigns' },

    // Loyalty/Fidelization
    { key: 'manager.loyalty.view', module: 'loyalty', description: 'View loyalty programs' },
    { key: 'manager.loyalty.manage', module: 'loyalty', description: 'Manage loyalty programs' },

    // Configuration
    { key: 'manager.config.view', module: 'config', description: 'View configuration' },
    { key: 'manager.config.manage', module: 'config', description: 'Manage configuration' }
];

const SAAS_PERMISSIONS = [
    // Invoices
    { key: 'saas.invoices.view', module: 'invoices', description: 'View invoices' },
    { key: 'saas.invoices.create', module: 'invoices', description: 'Create invoices' },
    { key: 'saas.invoices.update', module: 'invoices', description: 'Update invoices' },
    { key: 'saas.invoices.delete', module: 'invoices', description: 'Delete invoices' },
    { key: 'saas.invoices.send', module: 'invoices', description: 'Send invoices' },
    { key: 'saas.invoices.cancel', module: 'invoices', description: 'Cancel invoices' },

    // Taxes
    { key: 'saas.taxes.view', module: 'taxes', description: 'View tax information' },
    { key: 'saas.taxes.calculate', module: 'taxes', description: 'Calculate taxes' },
    { key: 'saas.taxes.manage', module: 'taxes', description: 'Manage tax settings' },

    // Payments
    { key: 'saas.payments.view', module: 'payments', description: 'View payments' },
    { key: 'saas.payments.create', module: 'payments', description: 'Record payments' },
    { key: 'saas.payments.reconcile', module: 'payments', description: 'Reconcile payments' },

    // Contacts (Fiscal)
    { key: 'saas.contacts.view', module: 'contacts', description: 'View fiscal contacts' },
    { key: 'saas.contacts.create', module: 'contacts', description: 'Create fiscal contacts' },
    { key: 'saas.contacts.update', module: 'contacts', description: 'Update fiscal contacts' },
    { key: 'saas.contacts.delete', module: 'contacts', description: 'Delete fiscal contacts' },

    // Finance Reports
    { key: 'saas.reports.view', module: 'reports', description: 'View financial reports' },
    { key: 'saas.reports.export', module: 'reports', description: 'Export financial reports' },

    // Fiscal Profile
    { key: 'saas.fiscal_profile.view', module: 'fiscal', description: 'View fiscal profile' },
    { key: 'saas.fiscal_profile.manage', module: 'fiscal', description: 'Manage fiscal profile' },

    // Empresas (Companies)
    { key: 'saas.empresas.view', module: 'empresas', description: 'View companies' },
    { key: 'saas.empresas.create', module: 'empresas', description: 'Create companies' },
    { key: 'saas.empresas.update', module: 'empresas', description: 'Update companies' },
    { key: 'saas.empresas.delete', module: 'empresas', description: 'Delete companies' }
];

const MARKETPLACE_PERMISSIONS = [
    // Catalog
    { key: 'marketplace.catalog.view', module: 'catalog', description: 'View marketplace catalog' },
    { key: 'marketplace.catalog.create', module: 'catalog', description: 'Create catalog listings' },
    { key: 'marketplace.catalog.update', module: 'catalog', description: 'Update catalog listings' },
    { key: 'marketplace.catalog.delete', module: 'catalog', description: 'Delete catalog listings' },
    { key: 'marketplace.catalog.publish', module: 'catalog', description: 'Publish catalog listings' },

    // Orders
    { key: 'marketplace.orders.view', module: 'orders', description: 'View marketplace orders' },
    { key: 'marketplace.orders.manage', module: 'orders', description: 'Manage marketplace orders' },

    // Promotions
    { key: 'marketplace.promos.view', module: 'promos', description: 'View promotions' },
    { key: 'marketplace.promos.manage', module: 'promos', description: 'Manage promotions' },

    // Settings
    { key: 'marketplace.settings.view', module: 'settings', description: 'View marketplace settings' },
    { key: 'marketplace.settings.manage', module: 'settings', description: 'Manage marketplace settings' }
];

// ================================================================
// ROLE TEMPLATES WITH PERMISSIONS
// ================================================================

const MANAGER_ROLES = {
    TENANT_ADMIN: {
        name: 'Administrador de Taller',
        description: 'Full access to Manager vertical',
        permissions: MANAGER_PERMISSIONS.map(p => p.key)
    },
    MECHANIC: {
        name: 'Mecánico',
        description: 'Technician with limited access',
        permissions: [
            'manager.workorders.view',
            'manager.workorders.update_status',
            'manager.workorders.add_notes',
            'manager.vehicles.view',
            'manager.customers.view',
            'manager.inventory.view',
            'manager.appointments.view'
        ]
    },
    RECEPTIONIST: {
        name: 'Recepcionista',
        description: 'Front desk with customer and appointment access',
        permissions: [
            'manager.workorders.view',
            'manager.workorders.create',
            'manager.appointments.view',
            'manager.appointments.create',
            'manager.appointments.update',
            'manager.customers.view',
            'manager.customers.create',
            'manager.customers.update',
            'manager.vehicles.view',
            'manager.vehicles.create',
            'manager.cashregister.view',
            'manager.cashregister.manage'
        ]
    },
    VIEWER: {
        name: 'Solo Lectura',
        description: 'View-only access',
        permissions: [
            'manager.workorders.view',
            'manager.appointments.view',
            'manager.customers.view',
            'manager.vehicles.view',
            'manager.inventory.view',
            'manager.reports.view'
        ]
    }
};

const SAAS_ROLES = {
    TENANT_ADMIN: {
        name: 'Administrador Contable',
        description: 'Full access to SaaS vertical',
        permissions: SAAS_PERMISSIONS.map(p => p.key)
    },
    ACCOUNTANT: {
        name: 'Contador',
        description: 'Accounting access',
        permissions: [
            'saas.invoices.view',
            'saas.invoices.create',
            'saas.invoices.update',
            'saas.invoices.send',
            'saas.taxes.view',
            'saas.taxes.calculate',
            'saas.payments.view',
            'saas.payments.create',
            'saas.payments.reconcile',
            'saas.contacts.view',
            'saas.contacts.create',
            'saas.contacts.update',
            'saas.reports.view',
            'saas.reports.export'
        ]
    },
    VIEWER: {
        name: 'Solo Lectura Contable',
        description: 'View-only access to accounting',
        permissions: [
            'saas.invoices.view',
            'saas.taxes.view',
            'saas.payments.view',
            'saas.contacts.view',
            'saas.reports.view'
        ]
    }
};

const MARKETPLACE_ROLES = {
    TENANT_ADMIN: {
        name: 'Administrador Marketplace',
        description: 'Full access to Marketplace vertical',
        permissions: MARKETPLACE_PERMISSIONS.map(p => p.key)
    },
    CATALOG_MANAGER: {
        name: 'Gestor de Catálogo',
        description: 'Manages catalog listings',
        permissions: [
            'marketplace.catalog.view',
            'marketplace.catalog.create',
            'marketplace.catalog.update',
            'marketplace.catalog.publish',
            'marketplace.orders.view'
        ]
    },
    PUBLISH_ONLY: {
        name: 'Solo Publicar',
        description: 'Can only publish listings',
        permissions: [
            'marketplace.catalog.view',
            'marketplace.catalog.publish'
        ]
    },
    VIEWER: {
        name: 'Solo Lectura Marketplace',
        description: 'View-only access to marketplace',
        permissions: [
            'marketplace.catalog.view',
            'marketplace.orders.view'
        ]
    }
};

// ================================================================
// LEGACY PERMISSION MAPPING
// ================================================================
// Maps old permission keys to new vertical-prefixed keys

const LEGACY_PERMISSION_MAP = {
    // Workorders
    'workorders.view': 'manager.workorders.view',
    'workorders.create': 'manager.workorders.create',
    'workorders.update': 'manager.workorders.update',
    'workorders.delete': 'manager.workorders.delete',
    'workorders.assign': 'manager.workorders.assign',
    'workorders.update_status': 'manager.workorders.update_status',
    'workorders.add_notes': 'manager.workorders.add_notes',

    // Appointments
    'appointments.view': 'manager.appointments.view',
    'appointments.create': 'manager.appointments.create',
    'appointments.update': 'manager.appointments.update',
    'appointments.delete': 'manager.appointments.delete',

    // Customers
    'customers.view': 'manager.customers.view',
    'customers.create': 'manager.customers.create',
    'customers.update': 'manager.customers.update',
    'customers.delete': 'manager.customers.delete',

    // Vehicles
    'vehicles.view': 'manager.vehicles.view',
    'vehicles.create': 'manager.vehicles.create',
    'vehicles.update': 'manager.vehicles.update',
    'vehicles.delete': 'manager.vehicles.delete',

    // Inventory
    'inventory.view': 'manager.inventory.view',
    'inventory.create': 'manager.inventory.create',
    'inventory.update': 'manager.inventory.update',
    'inventory.delete': 'manager.inventory.delete',

    // Purchases
    'purchases.view': 'manager.purchases.view',
    'purchases.create': 'manager.purchases.create',
    'purchases.update': 'manager.purchases.update',
    'purchases.delete': 'manager.purchases.delete',

    // Invoices (move to saas)
    'invoices.view': 'saas.invoices.view',
    'invoices.create': 'saas.invoices.create',
    'invoices.update': 'saas.invoices.update',
    'invoices.delete': 'saas.invoices.delete',

    // Payments (move to saas)
    'payments.view': 'saas.payments.view',
    'payments.create': 'saas.payments.create',
    'payments.update': 'saas.payments.update',
    'payments.delete': 'saas.payments.delete',

    // Reports
    'reports.view': 'manager.reports.view',
    'reports.export': 'manager.reports.export',

    // Cash register
    'cashregister.view': 'manager.cashregister.view',
    'cashregister.manage': 'manager.cashregister.manage',

    // Marketplace
    'marketplace.view': 'marketplace.catalog.view',
    'marketplace.manage': 'marketplace.settings.manage'
};

// ================================================================
// SEED FUNCTION
// ================================================================

async function seedVerticalPermissions() {
    console.log('🚀 Seeding vertical permissions...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get vertical IDs
        const verticals = await client.query('SELECT id, key FROM vertical');
        const verticalMap = {};
        for (const v of verticals.rows) {
            verticalMap[v.key] = v.id;
        }

        console.log('📋 Found verticals:', Object.keys(verticalMap));

        if (!verticalMap.manager || !verticalMap.saas || !verticalMap.marketplace) {
            throw new Error('Missing required verticals. Run the SQL migration first.');
        }

        // 2. Seed Manager permissions
        console.log('\n🔧 Seeding Manager permissions...');
        await seedPermissions(client, MANAGER_PERMISSIONS, verticalMap.manager);

        // 3. Seed SaaS permissions
        console.log('💼 Seeding SaaS permissions...');
        await seedPermissions(client, SAAS_PERMISSIONS, verticalMap.saas);

        // 4. Seed Marketplace permissions
        console.log('🛒 Seeding Marketplace permissions...');
        await seedPermissions(client, MARKETPLACE_PERMISSIONS, verticalMap.marketplace);

        // 5. Update existing permissions with vertical_id based on legacy mapping
        console.log('\n📝 Updating legacy permissions with vertical_id...');
        await updateLegacyPermissions(client, verticalMap);

        // 6. Enable Manager vertical for all existing tenants
        console.log('\n🏢 Enabling Manager vertical for existing tenants...');
        await enableManagerForAllTenants(client, verticalMap.manager);

        await client.query('COMMIT');

        console.log('\n✅ Vertical permissions seed completed!');

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

async function seedPermissions(client, permissions, verticalId) {
    let created = 0;
    let updated = 0;

    for (const perm of permissions) {
        const existing = await client.query(
            'SELECT id FROM permiso WHERE key = $1',
            [perm.key]
        );

        if (existing.rows.length > 0) {
            await client.query(
                `UPDATE permiso SET 
                    module = $1, 
                    descripcion = $2, 
                    vertical_id = $3
                WHERE id = $4`,
                [perm.module, perm.description, verticalId, existing.rows[0].id]
            );
            updated++;
        } else {
            await client.query(
                `INSERT INTO permiso (nombre, key, module, descripcion, vertical_id) 
                VALUES ($1, $1, $2, $3, $4)`,
                [perm.key, perm.module, perm.description, verticalId]
            );
            created++;
        }
    }

    console.log(`   Created: ${created}, Updated: ${updated}`);
}

async function updateLegacyPermissions(client, verticalMap) {
    let updated = 0;

    for (const [oldKey, newKey] of Object.entries(LEGACY_PERMISSION_MAP)) {
        // Determine vertical from new key prefix
        const verticalKey = newKey.split('.')[0];
        const verticalId = verticalMap[verticalKey];

        if (!verticalId) continue;

        // Update existing permission
        const result = await client.query(
            `UPDATE permiso SET vertical_id = $1 WHERE key = $2 OR nombre = $2`,
            [verticalId, oldKey]
        );

        if (result.rowCount > 0) {
            updated++;
        }
    }

    console.log(`   Updated ${updated} legacy permissions with vertical_id`);
}

async function enableManagerForAllTenants(client, managerVerticalId) {
    const result = await client.query(`
        INSERT INTO tenant_vertical (tenant_id, vertical_id, is_enabled, enabled_at)
        SELECT t.id, $1, true, NOW()
        FROM tenant t
        WHERE NOT EXISTS (
            SELECT 1 FROM tenant_vertical tv 
            WHERE tv.tenant_id = t.id AND tv.vertical_id = $1
        )
    `, [managerVerticalId]);

    console.log(`   Enabled Manager for ${result.rowCount} tenants`);
}

// Run if executed directly
if (require.main === module) {
    seedVerticalPermissions();
}

module.exports = {
    seedVerticalPermissions,
    MANAGER_PERMISSIONS,
    SAAS_PERMISSIONS,
    MARKETPLACE_PERMISSIONS,
    MANAGER_ROLES,
    SAAS_ROLES,
    MARKETPLACE_ROLES,
    LEGACY_PERMISSION_MAP
};
