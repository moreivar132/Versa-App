/**
 * VERSA - Rutas de Notificaciones para Portal Cliente
 * 
 * Endpoints:
 * - GET  /api/portal/notificaciones         → Listar notificaciones
 * - GET  /api/portal/notificaciones/count   → Contar no leídas
 * - PUT  /api/portal/notificaciones/:id     → Marcar como leída
 * - PUT  /api/portal/notificaciones/marcar-todas → Marcar todas como leídas
 */

const express = require('express');
const router = express.Router();
const notificacionService = require('../services/notificacionService');
const { customerAuth } = require('../middleware/customerAuth');

// Todas las rutas requieren autenticación
router.use(customerAuth);

/**
 * GET /api/portal/notificaciones
 * Obtener notificaciones del cliente
 */
router.get('/', async (req, res) => {
    try {
        const idCliente = req.customer.id_cliente;
        const soloNoLeidas = req.query.no_leidas === 'true';
        const limit = parseInt(req.query.limit) || 20;

        const notificaciones = await notificacionService.getNotificaciones(idCliente, soloNoLeidas, limit);

        res.json({
            ok: true,
            notificaciones
        });

    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener notificaciones'
        });
    }
});

/**
 * GET /api/portal/notificaciones/count
 * Contar notificaciones no leídas
 */
router.get('/count', async (req, res) => {
    try {
        const idCliente = req.customer.id_cliente;
        const count = await notificacionService.contarNoLeidas(idCliente);

        res.json({
            ok: true,
            count
        });

    } catch (error) {
        console.error('Error al contar notificaciones:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al contar notificaciones'
        });
    }
});

/**
 * PUT /api/portal/notificaciones/marcar-todas
 * Marcar todas como leídas
 */
router.put('/marcar-todas', async (req, res) => {
    try {
        const idCliente = req.customer.id_cliente;
        await notificacionService.marcarTodasLeidas(idCliente);

        res.json({
            ok: true,
            message: 'Todas las notificaciones marcadas como leídas'
        });

    } catch (error) {
        console.error('Error al marcar notificaciones:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al marcar notificaciones'
        });
    }
});

/**
 * PUT /api/portal/notificaciones/:id
 * Marcar una notificación como leída
 */
router.put('/:id', async (req, res) => {
    try {
        const idCliente = req.customer.id_cliente;
        const idNotificacion = req.params.id;

        await notificacionService.marcarLeida(idNotificacion, idCliente);

        res.json({
            ok: true,
            message: 'Notificación marcada como leída'
        });

    } catch (error) {
        console.error('Error al marcar notificación:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al marcar notificación'
        });
    }
});

module.exports = router;
