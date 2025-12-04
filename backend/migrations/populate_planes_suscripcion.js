// migrations/populate_planes_suscripcion.js
/**
 * Script de migración para poblar la tabla plan_suscripcion con los planes básicos
 * Este script debe ejecutarse UNA VEZ después de crear las tablas
 * 
 * IMPORTANTE: Los price_id de Stripe deben configurarse desde las variables de entorno
 */

require('dotenv').config();
const pool = require('../db');

async function populatePlanes() {
    try {
        console.log('🔄 Poblando tabla plan_suscripcion...');

        // Plan BÁSICO
        await pool.query(
            `INSERT INTO plan_suscripcion (
        nombre,
        descripcion,
        trial_dias_default,
        precio_mensual_stripe_price_id,
        precio_anual_stripe_price_id,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        trial_dias_default = EXCLUDED.trial_dias_default,
        precio_mensual_stripe_price_id = EXCLUDED.precio_mensual_stripe_price_id,
        precio_anual_stripe_price_id = EXCLUDED.precio_anual_stripe_price_id,
        activo = EXCLUDED.activo,
        updated_at = NOW()`,
            [
                'BASIC',
                'Ideal para talleres pequeños y autónomos. Hasta 2 usuarios, gestión de clientes y vehículos, órdenes de trabajo básicas.',
                15, // 15 días de trial
                process.env.STRIPE_PRICE_BASIC_MONTHLY || null,
                process.env.STRIPE_PRICE_BASIC_YEARLY || null,
                true,
            ]
        );
        console.log('✅ Plan BASIC creado/actualizado');

        // Plan PRO
        await pool.query(
            `INSERT INTO plan_suscripcion (
        nombre,
        descripcion,
        trial_dias_default,
        precio_mensual_stripe_price_id,
        precio_anual_stripe_price_id,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        trial_dias_default = EXCLUDED.trial_dias_default,
        precio_mensual_stripe_price_id = EXCLUDED.precio_mensual_stripe_price_id,
        precio_anual_stripe_price_id = EXCLUDED.precio_anual_stripe_price_id,
        activo = EXCLUDED.activo,
        updated_at = NOW()`,
            [
                'PRO',
                'Perfecto para talleres en crecimiento. Hasta 6 usuarios, hasta 3 sucursales, calendario avanzado multi-mecánico, informes y estadísticas.',
                15,
                process.env.STRIPE_PRICE_PRO_MONTHLY || null,
                process.env.STRIPE_PRICE_PRO_YEARLY || null,
                true,
            ]
        );
        console.log('✅ Plan PRO creado/actualizado');

        // Plan FLEET (Flotas & Renting)
        await pool.query(
            `INSERT INTO plan_suscripcion (
        nombre,
        descripcion,
        trial_dias_default,
        precio_mensual_stripe_price_id,
        precio_anual_stripe_price_id,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (nombre) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        trial_dias_default = EXCLUDED.trial_dias_default,
        precio_mensual_stripe_price_id = EXCLUDED.precio_mensual_stripe_price_id,
        precio_anual_stripe_price_id = EXCLUDED.precio_anual_stripe_price_id,
        activo = EXCLUDED.activo,
        updated_at = NOW()`,
            [
                'FLEET',
                'Gestión de flotas y empresas de renting. Usuarios ilimitados, gestión de flotas completa, contratos de renting, mantenimientos programados, hasta 150-200 vehículos, API para integraciones.',
                15,
                process.env.STRIPE_PRICE_FLEET_MONTHLY || null,
                process.env.STRIPE_PRICE_FLEET_YEARLY || null,
                true,
            ]
        );
        console.log('✅ Plan FLEET creado/actualizado');

        console.log('\n✨ Migración completada con éxito!');
        console.log('\n⚠️  IMPORTANTE: Asegúrate de configurar los price_id de Stripe en el archivo .env');
        console.log('   Variables necesarias:');
        console.log('   - STRIPE_PRICE_BASIC_MONTHLY');
        console.log('   - STRIPE_PRICE_BASIC_YEARLY');
        console.log('   - STRIPE_PRICE_PRO_MONTHLY');
        console.log('   - STRIPE_PRICE_PRO_YEARLY');
        console.log('   - STRIPE_PRICE_FLEET_MONTHLY');
        console.log('   - STRIPE_PRICE_FLEET_YEARLY\n');

        // Mostrar los planes creados
        const result = await pool.query('SELECT * FROM plan_suscripcion ORDER BY id');
        console.log('📋 Planes en la base de datos:');
        console.table(result.rows.map(row => ({
            ID: row.id,
            Nombre: row.nombre,
            'Trial Días': row.trial_dias_default,
            Activo: row.activo,
            'Price Mensual': row.precio_mensual_stripe_price_id ? '✓' : '✗',
            'Price Anual': row.precio_anual_stripe_price_id ? '✓' : '✗',
        })));

    } catch (error) {
        console.error('❌ Error poblando planes:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Ejecutar la migración
populatePlanes().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});
