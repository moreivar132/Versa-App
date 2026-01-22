/**
 * Rutas públicas del Marketplace
 * No requieren autenticación JWT
 */

const express = require('express');
const router = express.Router();
const marketplaceService = require('../services/marketplaceService');
const { customerAuthOptional } = require('../middleware/customerAuth');
const { getSystemDb } = require('../src/core/db/index'); // Use system DB for public cross-tenant search

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
 * Safely parse a value to float, returning null if invalid
 */
function safeParseCoord(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/marketplace/sucursales
 * Lista todas las sucursales activas para el selector de marketplace
 * Coords normalizados a number|null
 */
router.get('/sucursales', async (req, res) => {
    try {
        // Public search across tenants -> System Context
        const db = getSystemDb({ source: 'marketplace-public', reason: 'search_sucursales' });

        const result = await db.query(`
            SELECT DISTINCT
                s.id,
                s.nombre,
                s.direccion,
                ml.lat,
                ml.lng,
                s.id_tenant as tenant_id
            FROM public.sucursal s
            LEFT JOIN public.marketplace_listing ml ON ml.id_sucursal = s.id AND ml.activo = true
            ORDER BY s.nombre ASC
            LIMIT 100
        `);

        // Normalizar coordenadas
        const sucursales = (result.rows || []).map(row => ({
            id: row.id,
            nombre: row.nombre,
            direccion: row.direccion || null,
            lat: safeParseCoord(row.lat),
            lng: safeParseCoord(row.lng),
            tenant_id: row.tenant_id
        }));

        res.json(sucursales);
    } catch (error) {
        console.error('Error en GET /api/marketplace/sucursales:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener sucursales',
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
 * Body: { sucursalId, servicioId, fecha, hora, nombre, telefono, email, tipoVehiculo, matricula, notas, payment_mode? }
 * payment_mode: 'DEPOSITO' | 'TOTAL' | 'NONE' (opcional, se decide automáticamente si no viene)
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
            notas,
            payment_mode // 'DEPOSITO' | 'TOTAL' | 'NONE' (opcional)
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

        // Validar payment_mode si viene
        if (payment_mode && !['DEPOSITO', 'TOTAL', 'NONE'].includes(payment_mode)) {
            return res.status(400).json({
                ok: false,
                error: 'payment_mode inválido. Valores permitidos: DEPOSITO, TOTAL, NONE'
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
            id_cliente: req.customer?.id_cliente || null,
            // Modo de pago (el servicio decidirá el default si no viene)
            payment_mode: payment_mode || null
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
