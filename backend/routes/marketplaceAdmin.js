/**
 * Rutas de administración del Marketplace
 * Requieren autenticación JWT
 * Solo los admins del tenant pueden gestionar sus sucursales
 */

const express = require('express');
const router = express.Router();
const marketplaceService = require('../services/marketplaceService');

/**
 * GET /api/marketplace/admin/listing
 * Obtener listing de una sucursal
 * Query: ?id_sucursal=XX
 */
router.get('/listing', async (req, res) => {
    try {
        const { id_tenant } = req.user;
        const { id_sucursal } = req.query;

        if (!id_sucursal) {
            return res.status(400).json({
                ok: false,
                error: 'ID de sucursal requerido'
            });
        }

        // Get from repository
        const marketplaceRepo = require('../repositories/marketplaceRepository');

        // Pass req.db as client to repository
        const listing = await marketplaceRepo.getSucursalDetail(parseInt(id_sucursal), req.db);

        // Check if belongs to tenant
        if (listing && listing.id_tenant !== id_tenant) {
            return res.status(403).json({
                ok: false,
                error: 'Sucursal no pertenece a tu organización'
            });
        }

        res.json({
            ok: true,
            data: listing
        });
    } catch (error) {
        console.error('Error en GET /api/marketplace/admin/listing:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener listing',
            details: error.message
        });
    }
});

/**
 * PUT /api/marketplace/admin/listing
 * Actualizar/crear listing de una sucursal
 * Body: { id_sucursal, activo, titulo_publico, descripcion_publica, ... }
 */
router.put('/listing', async (req, res) => {
    try {
        const { id_tenant } = req.user;

        const {
            id_sucursal,
            activo,
            titulo_publico,
            descripcion_publica,
            telefono_publico,
            email_publico,
            whatsapp_publico,
            lat,
            lng,
            fotos_json,
            horario_json,
            politica_cancelacion,
            reserva_online_activa,
            min_horas_anticipacion,
            cancelacion_horas_limite,
            deposito_activo,
            deposito_tipo,
            deposito_valor
        } = req.body;

        // Validaciones
        if (!id_sucursal) {
            return res.status(400).json({
                ok: false,
                error: 'ID de sucursal requerido'
            });
        }

        const listingData = {
            id_sucursal: parseInt(id_sucursal),
            activo: activo !== undefined ? activo : true,
            titulo_publico,
            descripcion_publica,
            telefono_publico,
            email_publico,
            whatsapp_publico,
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            fotos_json: fotos_json || '[]',
            horario_json,
            politica_cancelacion,
            reserva_online_activa: reserva_online_activa !== undefined ? reserva_online_activa : true,
            min_horas_anticipacion: min_horas_anticipacion || 2,
            cancelacion_horas_limite: cancelacion_horas_limite || 24,
            deposito_activo: deposito_activo || false,
            deposito_tipo,
            deposito_valor: deposito_valor ? parseFloat(deposito_valor) : null
        };

        const listing = await marketplaceService.updateListing(id_tenant, listingData, req.db);

        res.json({
            ok: true,
            data: listing,
            mensaje: 'Listing actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error en PUT /api/marketplace/admin/listing:', error);

        if (error.message.includes('no pertenece')) {
            return res.status(403).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al actualizar listing',
            details: error.message
        });
    }
});

/**
 * POST /api/marketplace/admin/servicios
 * Agregar/actualizar servicio de una sucursal
 * Body: { id_sucursal, id_servicio, precio, duracion_min, ... }
 */
router.post('/servicios', async (req, res) => {
    try {
        const { id_tenant } = req.user;

        const {
            id_sucursal,
            id_servicio,
            precio,
            duracion_min,
            precio_desde,
            activo,
            rank_destacado,
            permite_reserva_online
        } = req.body;

        // Validaciones
        if (!id_sucursal || !id_servicio || !precio || !duracion_min) {
            return res.status(400).json({
                ok: false,
                error: 'Campos requeridos: id_sucursal, id_servicio, precio, duracion_min'
            });
        }

        if (precio < 0 || duracion_min <= 0) {
            return res.status(400).json({
                ok: false,
                error: 'Precio debe ser >= 0 y duración > 0'
            });
        }

        const servicioData = {
            id_sucursal: parseInt(id_sucursal),
            id_servicio: parseInt(id_servicio),
            precio: parseFloat(precio),
            duracion_min: parseInt(duracion_min),
            precio_desde: precio_desde || false,
            activo: activo !== undefined ? activo : true,
            rank_destacado: rank_destacado || 100,
            permite_reserva_online: permite_reserva_online !== undefined ? permite_reserva_online : true
        };

        const servicio = await marketplaceService.updateServicioSucursal(id_tenant, servicioData, req.db);

        res.json({
            ok: true,
            data: servicio,
            mensaje: 'Servicio configurado exitosamente'
        });
    } catch (error) {
        console.error('Error en POST /api/marketplace/admin/servicios:', error);

        if (error.message.includes('no pertenece')) {
            return res.status(403).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al configurar servicio',
            details: error.message
        });
    }
});

/**
 * POST /api/marketplace/admin/promociones
 * Crear una promoción
 * Body: { id_sucursal, id_servicio, titulo, tipo_descuento, valor_descuento, ... }
 */
router.post('/promociones', async (req, res) => {
    try {
        const { id_tenant } = req.user;

        const {
            id_sucursal,
            id_servicio,
            titulo,
            descripcion,
            tipo_descuento,
            valor_descuento,
            fecha_inicio,
            fecha_fin,
            dias_semana_json,
            horas_json,
            cupo_total,
            activo
        } = req.body;

        // Validaciones
        if (!id_sucursal || !titulo || !tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
            return res.status(400).json({
                ok: false,
                error: 'Campos requeridos: id_sucursal, titulo, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin'
            });
        }

        if (!['PORCENTAJE', 'FIJO'].includes(tipo_descuento)) {
            return res.status(400).json({
                ok: false,
                error: 'tipo_descuento debe ser PORCENTAJE o FIJO'
            });
        }

        if (valor_descuento <= 0) {
            return res.status(400).json({
                ok: false,
                error: 'valor_descuento debe ser mayor a 0'
            });
        }

        const promoData = {
            id_sucursal: parseInt(id_sucursal),
            id_servicio: id_servicio ? parseInt(id_servicio) : null,
            titulo,
            descripcion,
            tipo_descuento,
            valor_descuento: parseFloat(valor_descuento),
            fecha_inicio,
            fecha_fin,
            dias_semana_json,
            horas_json,
            cupo_total: cupo_total ? parseInt(cupo_total) : null,
            activo: activo !== undefined ? activo : true
        };

        const promo = await marketplaceService.createPromocion(id_tenant, promoData, req.db);

        res.status(201).json({
            ok: true,
            data: promo,
            mensaje: 'Promoción creada exitosamente'
        });
    } catch (error) {
        console.error('Error en POST /api/marketplace/admin/promociones:', error);

        if (error.message.includes('no pertenece')) {
            return res.status(403).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al crear promoción',
            details: error.message
        });
    }
});

/**
 * POST /api/marketplace/admin/listing/:id_sucursal/fotos
 * Actualizar fotos de un listing
 * Body: { fotos: [...urls] }
 */
router.post('/listing/:id_sucursal/fotos', async (req, res) => {
    try {
        const { id_tenant } = req.user;
        const id_sucursal = parseInt(req.params.id_sucursal);
        const { fotos } = req.body;

        if (!fotos || !Array.isArray(fotos)) {
            return res.status(400).json({
                ok: false,
                error: 'Se requiere un array de URLs de fotos'
            });
        }

        const listingData = {
            id_sucursal,
            fotos_json: JSON.stringify(fotos)
        };

        const listing = await marketplaceService.updateListing(id_tenant, listingData, req.db);

        res.json({
            ok: true,
            data: listing,
            mensaje: 'Fotos actualizadas exitosamente'
        });
    } catch (error) {
        console.error('Error en POST /api/marketplace/admin/listing/:id_sucursal/fotos:', error);

        if (error.message.includes('no pertenece')) {
            return res.status(403).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al actualizar fotos',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/admin/servicios-catalogo
 * Obtener catálogo completo de servicios disponibles
 */
router.get('/servicios-catalogo', async (req, res) => {
    try {
        const catalogo = await marketplaceService.getCatalogoServicios(req.db);

        res.json({
            ok: true,
            data: catalogo
        });
    } catch (error) {
        console.error('Error en GET /api/marketplace/admin/servicios-catalogo:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener catálogo',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/admin/servicios/:id_sucursal
 * Obtener servicios configurados de una sucursal (para admin)
 */
router.get('/servicios/:id_sucursal', async (req, res) => {
    try {
        const { id_tenant } = req.user;
        const id_sucursal = parseInt(req.params.id_sucursal);

        // Verificar que la sucursal pertenece al tenant
        const marketplaceRepo = require('../repositories/marketplaceRepository');
        const belongsToTenant = await marketplaceRepo.checkSucursalTenant(id_sucursal, id_tenant, req.db);

        if (!belongsToTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Sucursal no pertenece a tu organización'
            });
        }

        const servicios = await marketplaceRepo.getServiciosBySucursal(id_sucursal, req.db);

        res.json({
            ok: true,
            data: servicios
        });
    } catch (error) {
        console.error('Error en GET /api/marketplace/admin/servicios/:id_sucursal:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener servicios',
            details: error.message
        });
    }
});

/**
 * GET /api/marketplace/admin/promociones/:id_sucursal
 * Obtener promociones de una sucursal (para admin, incluye inactivas)
 */
router.get('/promociones/:id_sucursal', async (req, res) => {
    try {
        const { id_tenant } = req.user;
        const id_sucursal = parseInt(req.params.id_sucursal);

        // Verificar que la sucursal pertenece al tenant
        const marketplaceRepo = require('../repositories/marketplaceRepository');
        const belongsToTenant = await marketplaceRepo.checkSucursalTenant(id_sucursal, id_tenant, req.db);

        if (!belongsToTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Sucursal no pertenece a tu organización'
            });
        }

        // Obtener todas las promociones (no solo las activas)
        const result = await req.db.query(`
            SELECT 
                p.*,
                ms.nombre as servicio_nombre
            FROM marketplace_promo p
            LEFT JOIN marketplace_servicio ms ON ms.id = p.id_servicio
            WHERE p.id_sucursal = $1
            ORDER BY p.activo DESC, p.fecha_fin DESC
        `, [id_sucursal]);

        res.json({
            ok: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error en GET /api/marketplace/admin/promociones/:id_sucursal:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener promociones',
            details: error.message
        });
    }
});

module.exports = router;
