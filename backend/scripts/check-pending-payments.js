const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkPendingPayments() {
    try {
        console.log('Consultando pagos pendientes en DB...');
        const res = await pool.query(`
            SELECT id, id_cita, status, stripe_checkout_session_id, amount, created_at 
            FROM marketplace_reserva_pago 
            WHERE status = 'PENDING' AND stripe_checkout_session_id IS NOT NULL
            ORDER BY created_at DESC
        `);

        console.log(`Encontrados ${res.rows.length} pagos pendientes con Session ID.`);

        for (const pago of res.rows) {
            console.log(`\nVerificando Pago ID: ${pago.id} (Cita: ${pago.id_cita})`);
            try {
                const session = await stripe.checkout.sessions.retrieve(pago.stripe_checkout_session_id);
                console.log(` -> Stripe Status: ${session.status}, Payment Status: ${session.payment_status}`);

                if (session.payment_status === 'paid') {
                    console.log(' -> ¡Pago completado en Stripe pero PENDING en DB! Actualizando...');
                    await pool.query(`
                        UPDATE marketplace_reserva_pago 
                        SET status = 'PAID', 
                            payment_mode = $1,
                            updated_at = NOW(),
                            metadata_json = COALESCE(metadata_json, '{}')::jsonb || jsonb_build_object('recovered_via_script', true, 'recovered_at', NOW())
                        WHERE id = $2
                    `, [session.metadata.payment_mode || 'TOTAL', pago.id]);
                    console.log(' -> Actualizado a PAID.');
                } else {
                    console.log(' -> Coincide (No pagado).');
                    // Opcional: Si expiró, marcar como expired
                    if (session.status === 'expired') {
                        await pool.query("UPDATE marketplace_reserva_pago SET status = 'EXPIRED' WHERE id = $1", [pago.id]);
                        console.log(' -> Marcado como EXPIRED.');
                    }
                }
            } catch (err) {
                console.error(` -> Error consultando Stripe para sesión ${pago.stripe_checkout_session_id}:`, err.message);
            }
        }

        console.log('\nSincronización finalizada.');
        process.exit(0);
    } catch (error) {
        console.error('Error general:', error);
        process.exit(1);
    }
}

checkPendingPayments();
