// routes/stripe.js
/**
 * Rutas para la integración con Stripe (excepto webhook)
 * 
 * Endpoints:
 * - POST /create-checkout-session (suscripciones)
 * - GET /session-status (status de checkout session)
 * - GET /payment-status/:citaId (status de pago de reserva)
 * - POST /regenerate-payment (regenerar link de pago expirado)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const stripeService = require('../services/stripeService');

// ============================================================
// ENDPOINTS PARA SUSCRIPCIONES
// ============================================================

/**
 * POST /api/stripe/create-checkout-session
 * Crea una sesión de checkout de Stripe para suscripciones
 */
router.post('/create-checkout-session', async (req, res) => {
    try {
        const { tenantId, plan, billingInterval, email } = req.body;

        // Validación de parámetros
        if (!tenantId || !plan || !billingInterval) {
            return res.status(400).json({
                ok: false,
                error: 'Faltan parámetros requeridos: tenantId, plan, billingInterval',
            });
        }

        // Validar que billingInterval sea válido
        if (!['monthly', 'yearly'].includes(billingInterval)) {
            return res.status(400).json({
                ok: false,
                error: 'billingInterval debe ser "monthly" o "yearly"',
            });
        }

        // Verificar que el tenant existe
        const tenantCheck = await pool.query('SELECT id FROM tenant WHERE id = $1', [tenantId]);
        if (tenantCheck.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Tenant no encontrado',
            });
        }

        // Obtener el plan de suscripción de la base de datos
        const planQuery = await pool.query(
            'SELECT * FROM plan_suscripcion WHERE LOWER(nombre) = LOWER($1) AND activo = true',
            [plan]
        );

        if (planQuery.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: `Plan "${plan}" no encontrado o no está activo`,
            });
        }

        const planData = planQuery.rows[0];

        // Determinar el price_id según el intervalo de facturación
        let priceId;
        if (billingInterval === 'monthly') {
            priceId = planData.precio_mensual_stripe_price_id;
        } else {
            priceId = planData.precio_anual_stripe_price_id;
        }

        if (!priceId) {
            return res.status(400).json({
                ok: false,
                error: `No hay price_id configurado para el plan "${plan}" con intervalo "${billingInterval}"`,
            });
        }

        // Construir URLs de éxito y cancelación
        const successUrl = `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}&tenant_id=${tenantId}`;
        const cancelUrl = process.env.STRIPE_CANCEL_URL;

        // Crear la sesión de checkout
        const session = await stripeService.createCheckoutSession({
            priceId,
            tenantId,
            email,
            successUrl,
            cancelUrl,
        });

        // Responder con la URL de checkout
        res.json({
            ok: true,
            url: session.url,
        });

    } catch (error) {
        console.error('[Stripe] Error en /create-checkout-session:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al crear la sesión de checkout',
            details: error.message,
        });
    }
});

// ============================================================
// ENDPOINTS PARA PAGOS DE RESERVAS (MARKETPLACE)
// ============================================================

/**
 * GET /api/stripe/session-status
 * Obtiene el estado de una sesión de checkout de Stripe
 * Query: ?session_id=cs_xxx
 */
router.get('/session-status', async (req, res) => {
    try {
        const { session_id } = req.query;

        if (!session_id) {
            return res.status(400).json({
                ok: false,
                error: 'Falta el parámetro session_id',
            });
        }

        // Obtener la sesión de Stripe
        const session = await stripeService.getCheckoutSession(session_id);

        // Sincronización de estado (Recuperación ante fallos de Webhook)
        if (session.payment_status === 'paid') {
            const dbPagoCheck = await pool.query(
                `SELECT id, status FROM marketplace_reserva_pago WHERE stripe_checkout_session_id = $1`,
                [session_id]
            );

            if (dbPagoCheck.rows.length > 0 && dbPagoCheck.rows[0].status !== 'PAID') {
                console.log(`[Stripe] Recuperación: Marcando pago ${dbPagoCheck.rows[0].id} como PAID desde session-status`);

                await pool.query(
                    `UPDATE marketplace_reserva_pago 
                     SET status = 'PAID',
                         stripe_payment_intent_id = $1,
                         updated_at = NOW(),
                         metadata_json = COALESCE(metadata_json, '{}')::jsonb || $2::jsonb
                     WHERE stripe_checkout_session_id = $3`,
                    [
                        session.payment_intent,
                        JSON.stringify({
                            paid_at: new Date().toISOString(),
                            amount_received: session.amount_total / 100,
                            synced_via: 'session-status-endpoint'
                        }),
                        session_id
                    ]
                );
            }
        }

        // Volver a consultar la DB actualizada
        const dbResult = await pool.query(
            `SELECT mrp.*, c.motivo as servicio_nombre, 
                    COALESCE(c.nombre_cliente, cf.nombre) as cliente_nombre
             FROM marketplace_reserva_pago mrp
             LEFT JOIN citataller c ON c.id = mrp.id_cita
             LEFT JOIN clientefinal cf ON cf.id = mrp.id_cliente
             WHERE mrp.stripe_checkout_session_id = $1`,
            [session_id]
        );

        const dbPago = dbResult.rows[0] || null;

        res.json({
            ok: true,
            session: {
                id: session.id,
                status: session.status,
                payment_status: session.payment_status,
                amount_total: session.amount_total ? session.amount_total / 100 : null,
                currency: session.currency,
                customer_email: session.customer_email,
                metadata: session.metadata,
            },
            pago: dbPago ? {
                id: dbPago.id,
                id_cita: dbPago.id_cita,
                status: dbPago.status,
                amount: parseFloat(dbPago.amount),
                payment_mode: dbPago.payment_mode,
                cliente_nombre: dbPago.cliente_nombre,
                servicio_nombre: dbPago.servicio_nombre,
                created_at: dbPago.created_at,
            } : null,
        });

    } catch (error) {
        console.error('[Stripe] Error en /session-status:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener el estado de la sesión',
            details: error.message,
        });
    }
});

/**
 * GET /api/stripe/payment-status/:citaId
 * Obtiene el estado de pago de una cita específica
 */
router.get('/payment-status/:citaId', async (req, res) => {
    try {
        const { citaId } = req.params;

        if (!citaId || isNaN(parseInt(citaId))) {
            return res.status(400).json({
                ok: false,
                error: 'citaId inválido',
            });
        }

        // Buscar pagos de esta cita
        const result = await pool.query(
            `SELECT mrp.*, c.motivo as servicio_nombre, c.fecha_hora,
                    COALESCE(c.nombre_cliente, cf.nombre) as cliente_nombre,
                    s.nombre as sucursal_nombre
             FROM marketplace_reserva_pago mrp
             LEFT JOIN citataller c ON c.id = mrp.id_cita
             LEFT JOIN clientefinal cf ON cf.id = mrp.id_cliente
             LEFT JOIN sucursal s ON s.id = mrp.id_sucursal
             WHERE mrp.id_cita = $1
             ORDER BY mrp.created_at DESC`,
            [parseInt(citaId)]
        );

        if (result.rows.length === 0) {
            return res.json({
                ok: true,
                has_payment: false,
                pagos: [],
            });
        }

        const pagos = result.rows.map(p => ({
            id: p.id,
            status: p.status,
            amount: parseFloat(p.amount),
            currency: p.currency,
            payment_mode: p.payment_mode,
            checkout_url: p.status === 'PENDING' ? p.checkout_url : null, // Solo mostrar si pending
            stripe_checkout_session_id: p.stripe_checkout_session_id,
            cliente_nombre: p.cliente_nombre,
            servicio_nombre: p.servicio_nombre,
            sucursal_nombre: p.sucursal_nombre,
            fecha_cita: p.fecha_hora,
            created_at: p.created_at,
            updated_at: p.updated_at,
        }));

        // Determinar estado general
        const hasPaid = pagos.some(p => p.status === 'PAID');
        const hasPending = pagos.some(p => p.status === 'PENDING');

        res.json({
            ok: true,
            has_payment: true,
            is_paid: hasPaid,
            has_pending: hasPending,
            pagos: pagos,
        });

    } catch (error) {
        console.error('[Stripe] Error en /payment-status:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener el estado de pago',
            details: error.message,
        });
    }
});

/**
 * POST /api/stripe/regenerate-payment
 * Regenera un link de pago para una cita con pago expirado
 * Body: { id_cita, payment_mode? }
 */
router.post('/regenerate-payment', async (req, res) => {
    try {
        const { id_cita, payment_mode } = req.body;

        if (!id_cita) {
            return res.status(400).json({
                ok: false,
                error: 'Falta el parámetro id_cita',
            });
        }

        // Obtener el pago expirado
        const pagoResult = await pool.query(
            `SELECT mrp.*, c.motivo as servicio_nombre, c.correo_cliente, c.telefono_cliente,
                    COALESCE(c.nombre_cliente, cf.nombre) as cliente_nombre,
                    ml.titulo_publico as sucursal_nombre
             FROM marketplace_reserva_pago mrp
             LEFT JOIN citataller c ON c.id = mrp.id_cita
             LEFT JOIN clientefinal cf ON cf.id = mrp.id_cliente
             LEFT JOIN marketplace_listing ml ON ml.id_sucursal = mrp.id_sucursal
             WHERE mrp.id_cita = $1 AND mrp.status IN ('EXPIRED', 'FAILED', 'CANCELED')
             ORDER BY mrp.created_at DESC
             LIMIT 1`,
            [parseInt(id_cita)]
        );

        if (pagoResult.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'No se encontró un pago elegible para regenerar',
            });
        }

        const pagoAnterior = pagoResult.rows[0];
        const finalPaymentMode = payment_mode || pagoAnterior.payment_mode;

        // Crear nueva sesión de Stripe
        const stripeSession = await stripeService.createCheckoutSessionForBooking({
            id_tenant: pagoAnterior.id_tenant,
            id_sucursal: pagoAnterior.id_sucursal,
            id_cita: parseInt(id_cita),
            id_cliente: pagoAnterior.id_cliente,
            payment_mode: finalPaymentMode,
            amount: parseFloat(pagoAnterior.amount),
            currency: pagoAnterior.currency,
            customer_email: pagoAnterior.correo_cliente,
            customer_phone: pagoAnterior.telefono_cliente,
            service_name: pagoAnterior.servicio_nombre,
            sucursal_name: pagoAnterior.sucursal_nombre,
        });

        // Actualizar el registro antiguo a CANCELED (si no lo está)
        await pool.query(
            `UPDATE marketplace_reserva_pago 
             SET status = 'CANCELED', updated_at = NOW()
             WHERE id = $1 AND status != 'CANCELED'`,
            [pagoAnterior.id]
        );

        // Crear nuevo registro de pago
        await pool.query(
            `INSERT INTO marketplace_reserva_pago 
             (id_tenant, id_sucursal, id_cita, id_cliente, payment_mode, amount, currency, status, stripe_checkout_session_id, checkout_url, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10)`,
            [
                pagoAnterior.id_tenant,
                pagoAnterior.id_sucursal,
                parseInt(id_cita),
                pagoAnterior.id_cliente,
                finalPaymentMode,
                pagoAnterior.amount,
                pagoAnterior.currency,
                stripeSession.session_id,
                stripeSession.checkout_url,
                JSON.stringify({
                    regenerated_from: pagoAnterior.id,
                    regenerated_at: new Date().toISOString()
                })
            ]
        );

        res.json({
            ok: true,
            message: 'Nuevo link de pago generado',
            checkout_url: stripeSession.checkout_url,
            session_id: stripeSession.session_id,
        });

    } catch (error) {
        console.error('[Stripe] Error en /regenerate-payment:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al regenerar el link de pago',
            details: error.message,
        });
    }
});

module.exports = router;
