/**
 * Rutas públicas del Marketplace
 * No requieren autenticación JWT
 */

const express = require('express');
const router = express.Router();
const marketplaceService = require('../services/marketplaceService');
const { customerAuthOptional } = require('../middleware/customerAuth');

/**
 * POST /api/marketplace/search
 * Buscar talleres con filtros
 * Body: { ubicacion, distancia, servicio, tipoVehiculo, precioMin, precioMax, ratingMin, fecha, soloOfertas, lat, lng }
 */
router.post('/search', async (req, res) => {
    try {
        const filters = req.body;
        const talleres = await marketplaceService.searchTalleres(filters);

        res.json({
            ok: true,
            data: talleres,
            total: talleres.length
        });
    } catch (error) {
        console.error('Error en POST /api/marketplace/search:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al buscar talleres',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/search
 * Buscar talleres con filtros via query params
 * Query: ?ubicacion=...&distancia=...&servicio=...
 */
router.get('/search', async (req, res) => {
    try {
        const filters = {
            ubicacion: req.query.ubicacion,
            distancia: req.query.distancia ? parseInt(req.query.distancia) : undefined,
            servicio: req.query.servicio,
            tipoVehiculo: req.query.tipoVehiculo,
            precioMin: req.query.precioMin ? parseFloat(req.query.precioMin) : undefined,
            precioMax: req.query.precioMax ? parseFloat(req.query.precioMax) : undefined,
            ratingMin: req.query.ratingMin ? parseFloat(req.query.ratingMin) : undefined,
            soloOfertas: req.query.soloOfertas === 'true',
            lat: req.query.lat ? parseFloat(req.query.lat) : undefined,
            lng: req.query.lng ? parseFloat(req.query.lng) : undefined
        };

        const talleres = await marketplaceService.searchTalleres(filters);

        res.json({
            ok: true,
            data: talleres,
            total: talleres.length
        });
    } catch (error) {
        console.error('Error en GET /api/marketplace/search:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al buscar talleres',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/sucursales/:id
 * Obtener detalle completo de un taller
 */
router.get('/sucursales/:id', async (req, res) => {
    try {
        const idSucursal = parseInt(req.params.id);

        if (!idSucursal || isNaN(idSucursal)) {
            return res.status(400).json({
                ok: false,
                error: 'ID de sucursal inválido'
            });
        }

        const taller = await marketplaceService.getTallerDetail(idSucursal);

        res.json({
            ok: true,
            data: taller
        });
    } catch (error) {
        console.error(`Error en GET /api/marketplace/sucursales/${req.params.id}:`, error);

        if (error.message.includes('no encontrado') || error.message.includes('no activo')) {
            return res.status(404).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al obtener detalles del taller',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/sucursales/:id/availability
 * Obtener disponibilidad de un taller para una fecha
 * Query: ?fecha=YYYY-MM-DD&servicio_id=...
 */
router.get('/sucursales/:id/availability', async (req, res) => {
    try {
        const idSucursal = parseInt(req.params.id);
        const { fecha, servicio_id } = req.query;

        if (!idSucursal || isNaN(idSucursal)) {
            return res.status(400).json({
                ok: false,
                error: 'ID de sucursal inválido'
            });
        }

        if (!fecha) {
            return res.status(400).json({
                ok: false,
                error: 'Fecha requerida'
            });
        }

        const servicioId = servicio_id ? parseInt(servicio_id) : null;
        const slots = await marketplaceService.getAvailability(idSucursal, fecha, servicioId);

        res.json({
            ok: true,
            data: slots,
            fecha: fecha
        });
    } catch (error) {
        console.error(`Error en GET /api/marketplace/sucursales/${req.params.id}/availability:`, error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener disponibilidad',
            details: error.message
        });
    }
});

/**
 * POST /api/marketplace/book
 * Crear una reserva (público o cliente logueado)
 * Body: { sucursalId, servicioId, fecha, hora, nombre, telefono, email, tipoVehiculo, matricula, notas }
 * Si cliente está logueado (token en header), se vincula automáticamente la cita
 */
router.post('/book', customerAuthOptional, async (req, res) => {
    try {
        const {
            sucursalId,
            servicioId,
            fecha,
            hora,
            nombre,
            telefono,
            email,
            tipoVehiculo,
            matricula,
            notas
        } = req.body;

        // Validaciones básicas
        if (!sucursalId || !servicioId || !fecha || !hora || !nombre || !telefono || !email) {
            return res.status(400).json({
                ok: false,
                error: 'Faltan campos obligatorios',
                required: ['sucursalId', 'servicioId', 'fecha', 'hora', 'nombre', 'telefono', 'email']
            });
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                ok: false,
                error: 'Email inválido'
            });
        }

        const bookingData = {
            sucursalId: parseInt(sucursalId),
            servicioId: parseInt(servicioId),
            fecha,
            hora,
            nombre,
            telefono,
            email,
            tipoVehiculo,
            matricula,
            notas,
            // Si el cliente está logueado, usar su id_cliente
            id_cliente: req.customer?.id_cliente || null
        };

        const result = await marketplaceService.createBooking(bookingData);

        res.status(201).json({
            ok: true,
            ...result
        });
    } catch (error) {
        console.error('Error en POST /api/marketplace/book:', error);

        if (error.message.includes('no acepta reservas')) {
            return res.status(400).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al crear la reserva',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/servicios
 * Obtener catálogo de servicios disponibles
 */
router.get('/servicios', async (req, res) => {
    try {
        const catalogo = await marketplaceService.getCatalogoServicios();

        res.json({
            ok: true,
            data: catalogo
        });
    } catch (error) {
        console.error('Error en GET /api/marketplace/servicios:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener catálogo de servicios',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/sucursales/:id/reviews
 * Obtener reseñas de un taller
 */
router.get('/sucursales/:id/reviews', async (req, res) => {
    try {
        const idSucursal = parseInt(req.params.id);
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        if (!idSucursal || isNaN(idSucursal)) {
            return res.status(400).json({
                ok: false,
                error: 'ID de sucursal inválido'
            });
        }

        const reviews = await marketplaceService.getReviews(idSucursal, limit, offset);

        res.json({
            ok: true,
            data: reviews
        });
    } catch (error) {
        console.error(`Error en GET /api/marketplace/sucursales/${req.params.id}/reviews:`, error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener reseñas',
            details: error.message
        });
    }
});

module.exports = router;
