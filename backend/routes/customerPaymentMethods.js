// routes/customerPaymentMethods.js
/**
 * VERSA - Rutas de Payment Methods para el Portal Cliente
 * 
 * Endpoints:
 * - POST /setup-session - Crear sesión para guardar tarjeta
 * - GET / - Listar tarjetas guardadas
 * - POST /:id/default - Marcar tarjeta como predeterminada
 * - DELETE /:id - Eliminar tarjeta
 * - GET /pending-payments - Pagos pendientes del cliente
 * 
 * Todas las rutas requieren autenticación de cliente (customerAuth)
 */

const express = require('express');
const router = express.Router();
const { getTenantDb } = require('../src/core/db/tenant-db');
const stripeService = require('../services/stripeService');
const { customerAuth } = require('../middleware/customerAuth');

// Middleware de autenticación para todas las rutas
router.use(customerAuth);

// Middleware para inyectar req.db (Soporte RLS)
router.use((req, res, next) => {
    const ctx = {
        userId: req.customer?.id_cliente,
        requestId: req.headers['x-request-id']
    };
    // Permitimos sin tenant porque el customer token a veces no trae el tenant explícito
    // y se obtiene de la BD en cada handler.
    req.db = getTenantDb(ctx, { allowNoTenant: true });
    next();
});

// ==========================================================
// POST /api/cliente/payment-methods/setup-session
// Crear una sesión de Checkout para guardar tarjeta SIN cobrar
// ==========================================================
router.post('/setup-session', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;

        // Obtener datos del cliente
        const clienteResult = await req.db.query(
            `SELECT cf.email, cf.telefono, cf.nombre, cf.id_tenant
             FROM clientefinal cf
             WHERE cf.id = $1`,
            [id_cliente]
        );

        if (clienteResult.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Cliente no encontrado'
            });
        }

        const cliente = clienteResult.rows[0];

        // Asegurar que existe/crear Stripe Customer
        const stripe_customer_id = await stripeService.ensureStripeCustomer({
            id_cliente: id_cliente,
            email: cliente.email,
            phone: cliente.telefono,
            name: cliente.nombre
        });

        // Crear sesión de setup
        const { checkout_url, session_id } = await stripeService.createSetupCheckoutSession({
            stripe_customer_id: stripe_customer_id,
            id_cliente: id_cliente,
            id_tenant: cliente.id_tenant
        });

        res.json({
            ok: true,
            checkout_url: checkout_url,
            session_id: session_id
        });

    } catch (error) {
        console.error('[PaymentMethods] Error en setup-session:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al crear sesión de configuración de tarjeta',
            details: error.message
        });
    }
});

// ==========================================================
// GET /api/cliente/payment-methods
// Listar tarjetas guardadas del cliente
// ==========================================================
router.get('/', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;

        // Obtener stripe_customer_id del cliente
        const authResult = await req.db.query(
            `SELECT stripe_customer_id, stripe_default_payment_method_id 
             FROM clientefinal_auth 
             WHERE id_cliente = $1`,
            [id_cliente]
        );

        if (authResult.rows.length === 0 || !authResult.rows[0].stripe_customer_id) {
            // No tiene customer de Stripe aún
            return res.json({
                ok: true,
                has_customer: false,
                payment_methods: [],
                default_payment_method_id: null
            });
        }

        const { stripe_customer_id, stripe_default_payment_method_id } = authResult.rows[0];

        // Obtener payment methods de Stripe
        const paymentMethods = await stripeService.getCustomerPaymentMethods(stripe_customer_id);

        // Obtener el default real de Stripe
        let defaultPmId = stripe_default_payment_method_id;
        try {
            const customer = await stripeService.getCustomerWithDefaults(stripe_customer_id);
            if (customer.invoice_settings?.default_payment_method) {
                const defaultPm = customer.invoice_settings.default_payment_method;
                defaultPmId = typeof defaultPm === 'string' ? defaultPm : defaultPm.id;
            }
        } catch (e) {
            console.warn('[PaymentMethods] Error obteniendo defaults:', e.message);
        }

        // Marcar cuál es el default
        const methodsWithDefault = paymentMethods.map(pm => ({
            ...pm,
            is_default: pm.id === defaultPmId
        }));

        res.json({
            ok: true,
            has_customer: true,
            payment_methods: methodsWithDefault,
            default_payment_method_id: defaultPmId
        });

    } catch (error) {
        console.error('[PaymentMethods] Error listando payment methods:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener métodos de pago',
            details: error.message
        });
    }
});

// ==========================================================
// POST /api/cliente/payment-methods/:id/default
// Establecer una tarjeta como predeterminada
// ==========================================================
router.post('/:id/default', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;
        const payment_method_id = req.params.id;

        if (!payment_method_id || !payment_method_id.startsWith('pm_')) {
            return res.status(400).json({
                ok: false,
                error: 'ID de método de pago inválido'
            });
        }

        // Obtener stripe_customer_id
        const authResult = await req.db.query(
            `SELECT stripe_customer_id FROM clientefinal_auth WHERE id_cliente = $1`,
            [id_cliente]
        );

        if (authResult.rows.length === 0 || !authResult.rows[0].stripe_customer_id) {
            return res.status(400).json({
                ok: false,
                error: 'No tienes un perfil de pagos configurado'
            });
        }

        const stripe_customer_id = authResult.rows[0].stripe_customer_id;

        // Verificar que el PM pertenece a este customer
        const paymentMethods = await stripeService.getCustomerPaymentMethods(stripe_customer_id);
        const exists = paymentMethods.find(pm => pm.id === payment_method_id);

        if (!exists) {
            return res.status(403).json({
                ok: false,
                error: 'Este método de pago no te pertenece'
            });
        }

        // Establecer como default
        await stripeService.setDefaultPaymentMethod(
            stripe_customer_id,
            payment_method_id,
            id_cliente
        );

        res.json({
            ok: true,
            message: 'Tarjeta establecida como predeterminada'
        });

    } catch (error) {
        console.error('[PaymentMethods] Error estableciendo default:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al establecer tarjeta predeterminada',
            details: error.message
        });
    }
});

// ==========================================================
// DELETE /api/cliente/payment-methods/:id
// Eliminar una tarjeta (regla: siempre debe quedar mínimo 1)
// ==========================================================
router.delete('/:id', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;
        const payment_method_id = req.params.id;

        if (!payment_method_id || !payment_method_id.startsWith('pm_')) {
            return res.status(400).json({
                ok: false,
                error: 'ID de método de pago inválido'
            });
        }

        // Obtener stripe_customer_id
        const authResult = await req.db.query(
            `SELECT stripe_customer_id FROM clientefinal_auth WHERE id_cliente = $1`,
            [id_cliente]
        );

        if (authResult.rows.length === 0 || !authResult.rows[0].stripe_customer_id) {
            return res.status(400).json({
                ok: false,
                error: 'No tienes un perfil de pagos configurado'
            });
        }

        const stripe_customer_id = authResult.rows[0].stripe_customer_id;

        // Obtener todos los PM del cliente
        const paymentMethods = await stripeService.getCustomerPaymentMethods(stripe_customer_id);

        // Verificar que el PM pertenece a este customer
        const exists = paymentMethods.find(pm => pm.id === payment_method_id);
        if (!exists) {
            return res.status(403).json({
                ok: false,
                error: 'Este método de pago no te pertenece'
            });
        }

        // ⚠️ REGLA: Siempre debe quedar mínimo 1 tarjeta
        if (paymentMethods.length <= 1) {
            return res.status(400).json({
                ok: false,
                error: 'Debes mantener al menos una tarjeta guardada. Añade otra tarjeta antes de eliminar esta.'
            });
        }

        // Eliminar el PM
        await stripeService.detachPaymentMethod(payment_method_id);

        // Si era el default, limpiar en nuestra BD
        await req.db.query(
            `UPDATE clientefinal_auth 
             SET stripe_default_payment_method_id = NULL 
             WHERE id_cliente = $1 AND stripe_default_payment_method_id = $2`,
            [id_cliente, payment_method_id]
        );

        res.json({
            ok: true,
            message: 'Tarjeta eliminada correctamente'
        });

    } catch (error) {
        console.error('[PaymentMethods] Error eliminando PM:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al eliminar tarjeta',
            details: error.message
        });
    }
});

// ==========================================================
// GET /api/cliente/payment-methods/pending-payments
// Obtener pagos pendientes del cliente (citas con pago PENDING)
// ==========================================================
router.get('/pending-payments', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;

        // Buscar pagos pendientes
        const result = await req.db.query(
            `SELECT mrp.*, 
                    c.fecha_hora, c.motivo as servicio_nombre,
                    s.nombre as sucursal_nombre
             FROM marketplace_reserva_pago mrp
             LEFT JOIN citataller c ON c.id = mrp.id_cita
             LEFT JOIN sucursal s ON s.id = mrp.id_sucursal
             WHERE mrp.id_cliente = $1 
             AND mrp.status IN ('PENDING', 'EXPIRED')
             AND c.estado != 'cancelada'
             ORDER BY mrp.created_at DESC`,
            [id_cliente]
        );

        const pendingPayments = result.rows.map(p => ({
            id: p.id,
            id_cita: p.id_cita,
            status: p.status,
            amount: parseFloat(p.amount),
            currency: p.currency,
            payment_mode: p.payment_mode,
            checkout_url: p.status === 'PENDING' ? p.checkout_url : null,
            servicio_nombre: p.servicio_nombre,
            sucursal_nombre: p.sucursal_nombre,
            fecha_cita: p.fecha_hora,
            created_at: p.created_at,
            // URL para regenerar si está expirado
            can_regenerate: p.status === 'EXPIRED'
        }));

        res.json({
            ok: true,
            pending_payments: pendingPayments,
            total: pendingPayments.length
        });

    } catch (error) {
        console.error('[PaymentMethods] Error obteniendo pagos pendientes:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener pagos pendientes',
            details: error.message
        });
    }
});

// ==========================================================
// POST /api/cliente/payment-methods/regenerate/:citaId
// Regenerar link de pago para una cita con pago expirado
// ==========================================================
router.post('/regenerate/:citaId', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;
        const citaId = parseInt(req.params.citaId);

        if (isNaN(citaId)) {
            return res.status(400).json({
                ok: false,
                error: 'ID de cita inválido'
            });
        }

        // Verificar que la cita y pago pertenecen al cliente
        const pagoResult = await req.db.query(
            `SELECT mrp.*, c.correo_cliente, c.telefono_cliente, c.motivo,
                    ml.titulo_publico as sucursal_nombre
             FROM marketplace_reserva_pago mrp
             LEFT JOIN citataller c ON c.id = mrp.id_cita
             LEFT JOIN marketplace_listing ml ON ml.id_sucursal = mrp.id_sucursal
             WHERE mrp.id_cita = $1 AND mrp.id_cliente = $2 
             AND mrp.status IN ('EXPIRED', 'FAILED')
             ORDER BY mrp.created_at DESC
             LIMIT 1`,
            [citaId, id_cliente]
        );

        if (pagoResult.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'No se encontró un pago elegible para regenerar'
            });
        }

        const pagoAnterior = pagoResult.rows[0];

        // Obtener stripe_customer_id si existe
        const authResult = await req.db.query(
            `SELECT stripe_customer_id FROM clientefinal_auth WHERE id_cliente = $1`,
            [id_cliente]
        );
        const stripe_customer_id = authResult.rows[0]?.stripe_customer_id || null;

        // Crear nueva sesión de Stripe
        const stripeSession = await stripeService.createCheckoutSessionForBooking({
            id_tenant: pagoAnterior.id_tenant,
            id_sucursal: pagoAnterior.id_sucursal,
            id_cita: citaId,
            id_cliente: id_cliente,
            payment_mode: pagoAnterior.payment_mode,
            amount: parseFloat(pagoAnterior.amount),
            currency: pagoAnterior.currency,
            customer_email: pagoAnterior.correo_cliente,
            customer_phone: pagoAnterior.telefono_cliente,
            service_name: pagoAnterior.motivo,
            sucursal_name: pagoAnterior.sucursal_nombre,
            stripe_customer_id: stripe_customer_id
        });

        // Actualizar el registro antiguo a CANCELED
        await req.db.query(
            `UPDATE marketplace_reserva_pago 
             SET status = 'CANCELED', updated_at = NOW()
             WHERE id = $1`,
            [pagoAnterior.id]
        );

        // Crear nuevo registro de pago
        await req.db.query(
            `INSERT INTO marketplace_reserva_pago 
             (id_tenant, id_sucursal, id_cita, id_cliente, payment_mode, amount, currency, status, stripe_checkout_session_id, checkout_url, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10)`,
            [
                pagoAnterior.id_tenant,
                pagoAnterior.id_sucursal,
                citaId,
                id_cliente,
                pagoAnterior.payment_mode,
                pagoAnterior.amount,
                pagoAnterior.currency,
                stripeSession.session_id,
                stripeSession.checkout_url,
                JSON.stringify({
                    regenerated_from: pagoAnterior.id,
                    regenerated_at: new Date().toISOString(),
                    regenerated_by: 'client_portal'
                })
            ]
        );

        res.json({
            ok: true,
            message: 'Nuevo enlace de pago generado',
            checkout_url: stripeSession.checkout_url,
            session_id: stripeSession.session_id
        });

    } catch (error) {
        console.error('[PaymentMethods] Error regenerando pago:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al regenerar enlace de pago',
            details: error.message
        });
    }
});

// ==========================================================
// GET /api/cliente/payment-methods/saldo
// Obtener saldo a favor del cliente
// ==========================================================
router.get('/saldo', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;

        // Usar la vista para obtener saldo
        const result = await req.db.query(
            `SELECT * FROM vw_clientefinal_saldo WHERE id_cliente = $1`,
            [id_cliente]
        );

        if (result.rows.length === 0) {
            return res.json({
                ok: true,
                has_balance: false,
                saldo_actual: 0,
                currency: 'eur'
            });
        }

        // Podría haber múltiples monedas
        const saldos = result.rows.map(s => ({
            saldo_actual: parseFloat(s.saldo_actual) || 0,
            currency: s.currency
        }));

        // Por defecto mostrar EUR
        const saldoEur = saldos.find(s => s.currency === 'eur') || saldos[0] || { saldo_actual: 0, currency: 'eur' };

        res.json({
            ok: true,
            has_balance: saldoEur.saldo_actual > 0,
            saldo_actual: saldoEur.saldo_actual,
            currency: saldoEur.currency,
            all_currencies: saldos
        });

    } catch (error) {
        console.error('[PaymentMethods] Error obteniendo saldo:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener saldo',
            details: error.message
        });
    }
});

// ==========================================================
// POST /api/cliente/payment-methods/pay/:citaId
// Crear sesión de pago para una cita (bajo demanda)
// ==========================================================
router.post('/pay/:citaId', async (req, res) => {
    try {
        const id_cliente = req.customer.id_cliente;
        const citaId = parseInt(req.params.citaId);

        if (isNaN(citaId)) {
            return res.status(400).json({
                ok: false,
                error: 'ID de cita inválido'
            });
        }

        // Obtener la cita con todos los datos necesarios
        const citaResult = await req.db.query(
            `SELECT c.*, 
                    s.nombre as sucursal_nombre,
                    s.id_tenant,
                    cf.email as cliente_email,
                    cf.telefono as cliente_telefono,
                    cf.nombre as cliente_nombre
             FROM citataller c
             JOIN sucursal s ON s.id = c.id_sucursal
             LEFT JOIN clientefinal cf ON cf.id = c.id_cliente
             WHERE c.id = $1 AND c.id_cliente = $2`,
            [citaId, id_cliente]
        );

        if (citaResult.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Cita no encontrada o no te pertenece'
            });
        }

        const cita = citaResult.rows[0];

        // Verificar que la cita no esté cancelada
        if (cita.estado === 'cancelada') {
            return res.status(400).json({
                ok: false,
                error: 'No puedes pagar una cita cancelada'
            });
        }

        // Verificar si ya existe un pago PAID para esta cita
        const pagoExistente = await req.db.query(
            `SELECT id, status FROM marketplace_reserva_pago 
             WHERE id_cita = $1 AND status = 'PAID'`,
            [citaId]
        );

        if (pagoExistente.rows.length > 0) {
            return res.status(400).json({
                ok: false,
                error: 'Esta cita ya ha sido pagada'
            });
        }

        // Obtener precio del servicio desde marketplace_servicio_sucursal
        let amount = 0;

        // Buscar el servicio por nombre (motivo de la cita)
        if (cita.motivo) {
            try {
                const servicioResult = await req.db.query(
                    `SELECT mss.precio
                     FROM marketplace_servicio_sucursal mss
                     JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
                     WHERE mss.id_sucursal = $1 AND ms.nombre ILIKE $2
                     LIMIT 1`,
                    [cita.id_sucursal, `%${cita.motivo}%`]
                );

                if (servicioResult.rows.length > 0 && servicioResult.rows[0].precio) {
                    amount = parseFloat(servicioResult.rows[0].precio);
                }
            } catch (e) {
                console.warn('[PaymentMethods] Error buscando precio del servicio:', e.message);
            }
        }

        // Si aún no hay precio, usar un valor por defecto configurable
        if (amount <= 0) {
            // Precio por defecto de 30€ si no hay configuración
            amount = 30.00;
            console.warn(`[PaymentMethods] Usando precio por defecto (30€) para cita ${citaId}`);
        }

        // Obtener stripe_customer_id si existe
        const authResult = await req.db.query(
            `SELECT stripe_customer_id FROM clientefinal_auth WHERE id_cliente = $1`,
            [id_cliente]
        );
        const stripe_customer_id = authResult.rows[0]?.stripe_customer_id || null;

        // Crear sesión de Stripe
        const stripeSession = await stripeService.createCheckoutSessionForBooking({
            id_tenant: cita.id_tenant,
            id_sucursal: cita.id_sucursal,
            id_cita: citaId,
            id_cliente: id_cliente,
            payment_mode: 'TOTAL',
            amount: amount,
            currency: 'eur',
            customer_email: cita.cliente_email,
            customer_phone: cita.cliente_telefono,
            service_name: cita.motivo || 'Servicio',
            sucursal_name: cita.sucursal_nombre,
            stripe_customer_id: stripe_customer_id
        });

        // Verificar si ya existe un registro de pago PENDING para actualizar
        const pendingPago = await req.db.query(
            `SELECT id FROM marketplace_reserva_pago 
             WHERE id_cita = $1 AND status = 'PENDING'
             ORDER BY created_at DESC LIMIT 1`,
            [citaId]
        );

        if (pendingPago.rows.length > 0) {
            // Actualizar el existente
            await req.db.query(
                `UPDATE marketplace_reserva_pago 
                 SET stripe_checkout_session_id = $1, checkout_url = $2, updated_at = NOW()
                 WHERE id = $3`,
                [stripeSession.session_id, stripeSession.checkout_url, pendingPago.rows[0].id]
            );
        } else {
            // Crear nuevo registro de pago
            await req.db.query(
                `INSERT INTO marketplace_reserva_pago 
                 (id_tenant, id_sucursal, id_cita, id_cliente, payment_mode, amount, currency, status, stripe_checkout_session_id, checkout_url, metadata_json)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10)`,
                [
                    cita.id_tenant,
                    cita.id_sucursal,
                    citaId,
                    id_cliente,
                    'TOTAL',
                    amount,
                    'eur',
                    stripeSession.session_id,
                    stripeSession.checkout_url,
                    JSON.stringify({
                        created_by: 'client_portal_pay_button',
                        created_at: new Date().toISOString()
                    })
                ]
            );
        }

        console.log(`[PaymentMethods] Pago creado para cita ${citaId}: ${amount}€`);

        res.json({
            ok: true,
            message: 'Sesión de pago creada',
            checkout_url: stripeSession.checkout_url,
            session_id: stripeSession.session_id,
            amount: amount
        });

    } catch (error) {
        console.error('[PaymentMethods] Error creando pago:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al crear sesión de pago',
            details: error.message
        });
    }
});

module.exports = router;
