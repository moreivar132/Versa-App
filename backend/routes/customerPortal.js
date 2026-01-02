/**
 * VERSA - PASO 5: Portal Cliente
 * Rutas del portal cliente (requieren autenticación)
 * Montaje: /api/cliente (con middleware customerAuth)
 */

const express = require('express');
const router = express.Router();
const customerAuthService = require('../services/customerAuthService');
const customerPortalService = require('../services/customerPortalService');

/**
 * GET /api/cliente/me
 * Obtener perfil del cliente autenticado
 */
router.get('/me', async (req, res) => {
    try {
        const profile = await customerAuthService.getMe(req.customer.id_cliente);

        res.json({
            ok: true,
            data: profile
        });

    } catch (error) {
        console.error('Error obteniendo perfil:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al obtener perfil'
        });
    }
});

/**
 * PUT /api/cliente/me
 * Actualizar perfil del cliente
 */
router.put('/me', async (req, res) => {
    try {
        const { nombre, telefono, direccion } = req.body;

        const updated = await customerAuthService.updateMe(req.customer.id_cliente, {
            nombre,
            telefono,
            direccion
        });

        res.json({
            ok: true,
            data: updated
        });

    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al actualizar perfil'
        });
    }
});

/**
 * GET /api/cliente/citas
 * Obtener citas del cliente
 * Query: ?scope=upcoming|past|all (default: all)
 */
router.get('/citas', async (req, res) => {
    try {
        const scope = req.query.scope || 'all';
        const citas = await customerPortalService.getCitas(req.customer.id_cliente, scope);

        res.json({
            ok: true,
            data: citas,
            count: citas.length
        });

    } catch (error) {
        console.error('Error obteniendo citas:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener citas'
        });
    }
});

/**
 * GET /api/cliente/citas/:id/disponibilidad
 * Obtener disponibilidad para reprogramar una cita
 * Query: ?fecha=YYYY-MM-DD
 */
router.get('/citas/:id/disponibilidad', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);
        const fecha = req.query.fecha;

        if (!fecha) {
            return res.status(400).json({
                ok: false,
                error: 'Fecha es requerida'
            });
        }

        const slots = await customerPortalService.getDisponibilidadReprogramar(
            req.customer.id_cliente,
            idCita,
            fecha
        );

        res.json({
            ok: true,
            data: slots,
            fecha
        });

    } catch (error) {
        console.error('Error obteniendo disponibilidad:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al obtener disponibilidad'
        });
    }
});

/**
 * POST /api/cliente/citas/:id/cancelar
 * Cancelar una cita
 */
router.post('/citas/:id/cancelar', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);

        const result = await customerPortalService.cancelarCita(
            req.customer.id_cliente,
            idCita
        );

        res.json({
            ok: true,
            ...result
        });

    } catch (error) {
        console.error('Error cancelando cita:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al cancelar cita'
        });
    }
});

/**
 * POST /api/cliente/citas/:id/reprogramar
 * Reprogramar una cita
 * Body: { fecha, hora }
 */
router.post('/citas/:id/reprogramar', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);
        const { fecha, hora } = req.body;

        if (!fecha || !hora) {
            return res.status(400).json({
                ok: false,
                error: 'Fecha y hora son requeridos'
            });
        }

        const result = await customerPortalService.reprogramarCita(
            req.customer.id_cliente,
            idCita,
            fecha,
            hora
        );

        res.json({
            ok: true,
            ...result
        });

    } catch (error) {
        console.error('Error reprogramando cita:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al reprogramar cita'
        });
    }
});

/**
 * POST /api/cliente/citas/:id/resena
 * Crear reseña para una cita
 * Body: { puntuacion, comentario, fotos? }
 */
router.post('/citas/:id/resena', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);
        const { puntuacion, comentario, fotos } = req.body;

        if (!puntuacion || puntuacion < 1 || puntuacion > 5) {
            return res.status(400).json({
                ok: false,
                error: 'Puntuación válida requerida (1-5)'
            });
        }

        const result = await customerPortalService.crearResena(
            req.customer.id_cliente,
            idCita,
            puntuacion,
            comentario,
            fotos || []
        );

        res.json({
            ok: true,
            data: result
        });

    } catch (error) {
        console.error('Error creando reseña:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message || 'Error al crear reseña'
        });
    }
});

/**
 * GET /api/cliente/citas/:id/resena
 * Obtener reseña de una cita (si existe)
 */
router.get('/citas/:id/resena', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);

        const resena = await customerPortalService.getResenaPorCita(
            req.customer.id_cliente,
            idCita
        );

        res.json({
            ok: true,
            data: resena
        });

    } catch (error) {
        console.error('Error obteniendo reseña:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message || 'Error al obtener reseña'
        });
    }
});

/**
 * PUT /api/cliente/citas/:id/resena
 * Actualizar reseña de una cita
 * Body: { puntuacion?, comentario?, fotos? }
 */
router.put('/citas/:id/resena', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);
        const { puntuacion, comentario, fotos } = req.body;

        if (puntuacion && (puntuacion < 1 || puntuacion > 5)) {
            return res.status(400).json({
                ok: false,
                error: 'Puntuación válida requerida (1-5)'
            });
        }

        const result = await customerPortalService.actualizarResena(
            req.customer.id_cliente,
            idCita,
            { puntuacion, comentario, fotos }
        );

        res.json({
            ok: true,
            data: result
        });

    } catch (error) {
        console.error('Error actualizando reseña:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message || 'Error al actualizar reseña'
        });
    }
});

/**
 * DELETE /api/cliente/citas/:id/resena
 * Eliminar reseña de una cita
 */
router.delete('/citas/:id/resena', async (req, res) => {
    try {
        const idCita = parseInt(req.params.id);

        await customerPortalService.eliminarResena(
            req.customer.id_cliente,
            idCita
        );

        res.json({
            ok: true,
            message: 'Reseña eliminada correctamente'
        });

    } catch (error) {
        console.error('Error eliminando reseña:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message || 'Error al eliminar reseña'
        });
    }
});

/**
 * GET /api/cliente/pagos
 * Obtener pagos del cliente
 */
router.get('/pagos', async (req, res) => {
    try {
        const pagos = await customerPortalService.getPagos(req.customer.id_cliente);

        res.json({
            ok: true,
            data: pagos,
            count: pagos.length
        });

    } catch (error) {
        console.error('Error obteniendo pagos:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener pagos'
        });
    }
});

/**
 * GET /api/cliente/resenas
 * Obtener todas las reseñas del cliente
 */
router.get('/resenas', async (req, res) => {
    try {
        const resenas = await customerPortalService.getResenasCliente(req.customer.id_cliente);

        res.json({
            ok: true,
            data: resenas,
            count: resenas.length
        });

    } catch (error) {
        console.error('Error obteniendo reseñas:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener reseñas'
        });
    }
});

/**
 * GET /api/cliente/fidelizacion/promos
 * Obtener todas las promociones activas
 */
router.get('/fidelizacion/promos', async (req, res) => {
    try {
        const idTenant = req.customer.id_tenant || 1;
        const pool = require('../db');

        const result = await pool.query(`
            SELECT id, titulo, descripcion, starts_at, ends_at
            FROM fidelizacion_promo 
            WHERE id_tenant = $1 
              AND activo = true 
              AND starts_at <= CURRENT_TIMESTAMP 
              AND ends_at >= CURRENT_TIMESTAMP
            ORDER BY created_at DESC
        `, [idTenant]);

        res.json({
            ok: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error obteniendo promos:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener promociones'
        });
    }
});

/**
 * GET /api/cliente/fidelizacion
 * Obtener datos de fidelización (Tarjeta)
 */
router.get('/fidelizacion', async (req, res) => {
    try {
        // Asumimos tenant 1 por defecto si no está en el request
        const idTenant = req.customer.id_tenant || 1;

        // Usamos enrollMember para asegurar que existe y obtener los datos
        // Si ya existe, nos devuelve los datos actuales
        const result = await require('../services/fidelizacionService').enrollMember(
            req.customer.id_cliente,
            idTenant
        );

        // Obtener detalle completo para tener el balance actualizado
        // enrollMember devuelve member basico, queremos el saldo
        const detail = await require('../services/fidelizacionService').getCardData(result.token);

        res.json({
            ok: true,
            data: {
                ...detail,
                token: result.token, // Necesario para generar el QR si no viene en detail
                publicUrl: result.publicUrl
            }
        });

    } catch (error) {
        console.error('Error obteniendo datos de fidelización:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener tarjeta de fidelización'
        });
    }
});

// ... (existing code)

/**
 * GET /api/cliente/notificaciones
 */
router.get('/notificaciones', async (req, res) => {
    try {
        const idTenant = req.customer.id_tenant || 1;
        // Require dinámico para evitar require cycles si fuera necesario, o movemos al top
        const notificationService = require('../services/notificationService');
        const notificaciones = await notificationService.getClientNotifications(idTenant, req.customer.id_cliente);

        res.json({ ok: true, data: notificaciones });
    } catch (error) {
        console.error('Error notificaciones:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener notificaciones' });
    }
});

/**
 * POST /api/cliente/notificaciones/:id/leido
 */
router.post('/notificaciones/:id/leido', async (req, res) => {
    try {
        const notificationService = require('../services/notificationService');
        await notificationService.markAsRead(req.params.id, req.customer.id_cliente);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false });
    }
});

module.exports = router;
