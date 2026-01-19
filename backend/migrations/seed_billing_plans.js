// migrations/seed_billing_plans.js
/**
 * Seeds/updates billing plans with features_json
 * 
 * Plans:
 * - BASIC: Basic features for small workshops
 * - PRO: Advanced features for growing workshops
 * - BUSINESS: All features, unlimited (was FLEET)
 * - TRIAL_FULL_15D: Internal trial with BUSINESS features (no Stripe price)
 */

require('dotenv').config();
const pool = require('../db');

// Feature constants - same as used in featureGate.js
const FEATURES = {
    FEATURE_APPOINTMENTS: 'FEATURE_APPOINTMENTS',
    FEATURE_CUSTOMERS: 'FEATURE_CUSTOMERS',
    FEATURE_VEHICLES: 'FEATURE_VEHICLES',
    FEATURE_INVOICES: 'FEATURE_INVOICES',
    FEATURE_MARKETING_AUTOMATIONS: 'FEATURE_MARKETING_AUTOMATIONS',
    FEATURE_ROLES_PERMISSIONS: 'FEATURE_ROLES_PERMISSIONS',
    FEATURE_ANALYTICS: 'FEATURE_ANALYTICS',
    FEATURE_INTEGRATIONS: 'FEATURE_INTEGRATIONS',
    FEATURE_INVENTORY: 'FEATURE_INVENTORY',
    FEATURE_PURCHASES: 'FEATURE_PURCHASES',
    FEATURE_SALES: 'FEATURE_SALES',
    FEATURE_CASH_REGISTER: 'FEATURE_CASH_REGISTER',
    FEATURE_FIDELIZATION: 'FEATURE_FIDELIZATION',
    FEATURE_MARKETPLACE: 'FEATURE_MARKETPLACE'
};

// Plan definitions
const plans = [
    {
        nombre: 'BASIC',
        plan_key: 'basic',
        descripcion: 'Ideal para talleres pequeños y autónomos. Hasta 2 usuarios, gestión de clientes y vehículos, órdenes de trabajo básicas.',
        trial_dias_default: 15,
        incluye_marketplace: false,
        incluye_crm: true,
        features_json: {
            [FEATURES.FEATURE_APPOINTMENTS]: true,
            [FEATURES.FEATURE_CUSTOMERS]: true,
            [FEATURES.FEATURE_VEHICLES]: true,
            [FEATURES.FEATURE_INVOICES]: false,
            [FEATURES.FEATURE_MARKETING_AUTOMATIONS]: false,
            [FEATURES.FEATURE_ROLES_PERMISSIONS]: false,
            [FEATURES.FEATURE_ANALYTICS]: false,
            [FEATURES.FEATURE_INTEGRATIONS]: false,
            [FEATURES.FEATURE_INVENTORY]: true,
            [FEATURES.FEATURE_PURCHASES]: false,
            [FEATURES.FEATURE_SALES]: true,
            [FEATURES.FEATURE_CASH_REGISTER]: true,
            [FEATURES.FEATURE_FIDELIZATION]: false,
            [FEATURES.FEATURE_MARKETPLACE]: false,
            max_users: 2,
            max_sucursales: 1
        },
        stripe_monthly_env: 'STRIPE_PRICE_BASIC_MONTHLY',
        stripe_yearly_env: 'STRIPE_PRICE_BASIC_YEARLY'
    },
    {
        nombre: 'PRO',
        plan_key: 'pro',
        descripcion: 'Perfecto para talleres en crecimiento. Hasta 6 usuarios, hasta 3 sucursales, calendario avanzado, informes y estadísticas.',
        trial_dias_default: 15,
        incluye_marketplace: true,
        incluye_crm: true,
        features_json: {
            [FEATURES.FEATURE_APPOINTMENTS]: true,
            [FEATURES.FEATURE_CUSTOMERS]: true,
            [FEATURES.FEATURE_VEHICLES]: true,
            [FEATURES.FEATURE_INVOICES]: true,
            [FEATURES.FEATURE_MARKETING_AUTOMATIONS]: true,
            [FEATURES.FEATURE_ROLES_PERMISSIONS]: true,
            [FEATURES.FEATURE_ANALYTICS]: true,
            [FEATURES.FEATURE_INTEGRATIONS]: false,
            [FEATURES.FEATURE_INVENTORY]: true,
            [FEATURES.FEATURE_PURCHASES]: true,
            [FEATURES.FEATURE_SALES]: true,
            [FEATURES.FEATURE_CASH_REGISTER]: true,
            [FEATURES.FEATURE_FIDELIZATION]: true,
            [FEATURES.FEATURE_MARKETPLACE]: true,
            max_users: 6,
            max_sucursales: 3
        },
        stripe_monthly_env: 'STRIPE_PRICE_PRO_MONTHLY',
        stripe_yearly_env: 'STRIPE_PRICE_PRO_YEARLY'
    },
    {
        nombre: 'BUSINESS',
        plan_key: 'business',
        descripcion: 'Gestión completa para grandes talleres y redes. Usuarios ilimitados, sucursales ilimitadas, API, integraciones avanzadas.',
        trial_dias_default: 15,
        incluye_marketplace: true,
        incluye_crm: true,
        features_json: {
            [FEATURES.FEATURE_APPOINTMENTS]: true,
            [FEATURES.FEATURE_CUSTOMERS]: true,
            [FEATURES.FEATURE_VEHICLES]: true,
            [FEATURES.FEATURE_INVOICES]: true,
            [FEATURES.FEATURE_MARKETING_AUTOMATIONS]: true,
            [FEATURES.FEATURE_ROLES_PERMISSIONS]: true,
            [FEATURES.FEATURE_ANALYTICS]: true,
            [FEATURES.FEATURE_INTEGRATIONS]: true,
            [FEATURES.FEATURE_INVENTORY]: true,
            [FEATURES.FEATURE_PURCHASES]: true,
            [FEATURES.FEATURE_SALES]: true,
            [FEATURES.FEATURE_CASH_REGISTER]: true,
            [FEATURES.FEATURE_FIDELIZATION]: true,
            [FEATURES.FEATURE_MARKETPLACE]: true,
            max_users: null,  // unlimited
            max_sucursales: null  // unlimited
        },
        stripe_monthly_env: 'STRIPE_PRICE_BUSINESS_MONTHLY',
        stripe_yearly_env: 'STRIPE_PRICE_BUSINESS_YEARLY'
    },
    {
        nombre: 'TRIAL_FULL_15D',
        plan_key: 'trial_full_15d',
        descripcion: 'Período de prueba gratuito de 15 días con acceso completo a todas las funcionalidades.',
        trial_dias_default: 15,
        incluye_marketplace: true,
        incluye_crm: true,
        features_json: {
            // Same as BUSINESS - full access during trial
            [FEATURES.FEATURE_APPOINTMENTS]: true,
            [FEATURES.FEATURE_CUSTOMERS]: true,
            [FEATURES.FEATURE_VEHICLES]: true,
            [FEATURES.FEATURE_INVOICES]: true,
            [FEATURES.FEATURE_MARKETING_AUTOMATIONS]: true,
            [FEATURES.FEATURE_ROLES_PERMISSIONS]: true,
            [FEATURES.FEATURE_ANALYTICS]: true,
            [FEATURES.FEATURE_INTEGRATIONS]: true,
            [FEATURES.FEATURE_INVENTORY]: true,
            [FEATURES.FEATURE_PURCHASES]: true,
            [FEATURES.FEATURE_SALES]: true,
            [FEATURES.FEATURE_CASH_REGISTER]: true,
            [FEATURES.FEATURE_FIDELIZATION]: true,
            [FEATURES.FEATURE_MARKETPLACE]: true,
            max_users: null,
            max_sucursales: null
        },
        // No Stripe prices - this is internal only
        stripe_monthly_env: null,
        stripe_yearly_env: null
    }
];

async function seedBillingPlans() {
    console.log('🔄 Seeding/updating billing plans...\n');

    for (const plan of plans) {
        try {
            const monthlyPriceId = plan.stripe_monthly_env ? process.env[plan.stripe_monthly_env] || null : null;
            const yearlyPriceId = plan.stripe_yearly_env ? process.env[plan.stripe_yearly_env] || null : null;

            // Check if plan exists
            const existingPlan = await pool.query(
                'SELECT id FROM plan_suscripcion WHERE nombre = $1',
                [plan.nombre]
            );

            if (existingPlan.rows.length > 0) {
                // Update existing plan
                await pool.query(`
                    UPDATE plan_suscripcion SET
                        plan_key = $1,
                        descripcion = $2,
                        trial_dias_default = $3,
                        incluye_marketplace = $4,
                        incluye_crm = $5,
                        features_json = $6,
                        precio_mensual_stripe_price_id = COALESCE($7, precio_mensual_stripe_price_id),
                        precio_anual_stripe_price_id = COALESCE($8, precio_anual_stripe_price_id),
                        updated_at = NOW()
                    WHERE nombre = $9
                `, [
                    plan.plan_key,
                    plan.descripcion,
                    plan.trial_dias_default,
                    plan.incluye_marketplace,
                    plan.incluye_crm,
                    JSON.stringify(plan.features_json),
                    monthlyPriceId,
                    yearlyPriceId,
                    plan.nombre
                ]);
                console.log(`✅ Updated plan: ${plan.nombre} (${plan.plan_key})`);
            } else {
                // Insert new plan
                await pool.query(`
                    INSERT INTO plan_suscripcion (
                        nombre, plan_key, descripcion, trial_dias_default,
                        incluye_marketplace, incluye_crm, features_json,
                        precio_mensual_stripe_price_id, precio_anual_stripe_price_id,
                        activo
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
                `, [
                    plan.nombre,
                    plan.plan_key,
                    plan.descripcion,
                    plan.trial_dias_default,
                    plan.incluye_marketplace,
                    plan.incluye_crm,
                    JSON.stringify(plan.features_json),
                    monthlyPriceId,
                    yearlyPriceId
                ]);
                console.log(`✅ Created plan: ${plan.nombre} (${plan.plan_key})`);
            }

            // Log feature summary
            const enabledFeatures = Object.entries(plan.features_json)
                .filter(([k, v]) => v === true)
                .map(([k]) => k.replace('FEATURE_', ''))
                .join(', ');
            console.log(`   Features: ${enabledFeatures || 'None'}`);
            console.log(`   Limits: ${plan.features_json.max_users ?? '∞'} users, ${plan.features_json.max_sucursales ?? '∞'} sucursales\n`);

        } catch (error) {
            console.error(`❌ Error with plan ${plan.nombre}:`, error.message);
        }
    }

    console.log('\n✨ Billing plans seeding complete!');

    // Show final state
    const result = await pool.query(`
        SELECT id, nombre, plan_key, activo, 
               precio_mensual_stripe_price_id IS NOT NULL as has_monthly,
               precio_anual_stripe_price_id IS NOT NULL as has_yearly
        FROM plan_suscripcion 
        ORDER BY id
    `);

    console.log('\n📋 Plans in database:');
    console.table(result.rows.map(row => ({
        ID: row.id,
        Nombre: row.nombre,
        'Plan Key': row.plan_key,
        Activo: row.activo ? '✓' : '✗',
        'Monthly Price': row.has_monthly ? '✓' : '✗',
        'Yearly Price': row.has_yearly ? '✓' : '✗'
    })));

    console.log('\n⚠️  IMPORTANTE: Configura los price_id de Stripe en .env:');
    console.log('   - STRIPE_PRICE_BASIC_MONTHLY / YEARLY');
    console.log('   - STRIPE_PRICE_PRO_MONTHLY / YEARLY');
    console.log('   - STRIPE_PRICE_BUSINESS_MONTHLY / YEARLY');
}

// Run if executed directly
if (require.main === module) {
    seedBillingPlans()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { seedBillingPlans, FEATURES, plans };
