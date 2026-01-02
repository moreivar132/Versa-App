/**
 * Rutas administrativas de Fidelización
 * Requieren autenticación JWT
 */

const express = require('express');
const router = express.Router();
const fidelizacionService = require('../services/fidelizacionService');

/**
 * GET /api/admin/fidelizacion/members
 * Buscar o listar miembros
 * Query: ?search=... (opcional)
 */
router.get('/members', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const { search } = req.query;

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        let members;
        if (search && search.trim().length > 0) {
            members = await fidelizacionService.searchMembers(idTenant, search.trim());
        } else {
            members = await fidelizacionService.listMembers(idTenant);
        }

        res.json({
            ok: true,
            data: members
        });

    } catch (error) {
        console.error('Error en GET /api/admin/fidelizacion/members:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al buscar miembros'
        });
    }
});

/**
 * GET /api/admin/fidelizacion/members/:id
 * Obtener detalle de un miembro
 */
router.get('/members/:id', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idMiembro = parseInt(req.params.id);

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        const member = await fidelizacionService.getMemberDetail(idMiembro, idTenant);

        if (!member) {
            return res.status(404).json({
                ok: false,
                error: 'Miembro no encontrado'
            });
        }

        res.json({
            ok: true,
            data: member
        });

    } catch (error) {
        console.error('Error en GET /api/admin/fidelizacion/members/:id:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener miembro'
        });
    }
});

/**
 * POST /api/admin/fidelizacion/members/enroll
 * Inscribir un cliente existente
 * Body: { id_cliente }
 */
router.post('/members/enroll', async (req, res) => {
    try {
        const { id_cliente } = req.body;
        const idTenant = req.user.id_tenant;

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        if (!id_cliente) {
            return res.status(400).json({
                ok: false,
                error: 'id_cliente es requerido'
            });
        }

        const result = await fidelizacionService.enrollMember(id_cliente, idTenant);

        res.status(201).json({
            ok: true,
            message: 'Cliente inscrito exitosamente',
            data: {
                miembro: result.miembro,
                public_url: result.publicUrl,
                cliente_nombre: result.clienteNombre
            },
            // Token solo se muestra una vez
            _one_time_token: result.token
        });

    } catch (error) {
        console.error('Error en POST /api/admin/fidelizacion/members/enroll:', error);

        if (error.message.includes('no encontrado') || error.message.includes('no pertenece')) {
            return res.status(404).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al inscribir cliente'
        });
    }
});

/**
 * POST /api/admin/fidelizacion/members/:id/link/reset
 * Regenerar token de acceso
 */
router.post('/members/:id/link/reset', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idMiembro = parseInt(req.params.id);

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        const result = await fidelizacionService.regenerateToken(idMiembro, idTenant);

        res.json({
            ok: true,
            message: 'Link regenerado exitosamente',
            data: {
                public_url: result.publicUrl
            },
            _one_time_token: result.token
        });

    } catch (error) {
        console.error('Error en POST /api/admin/fidelizacion/members/:id/link/reset:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al regenerar link'
        });
    }
});

/**
 * GET /api/admin/fidelizacion/members/:id/history
 * Obtener historial de movimientos
 */
router.get('/members/:id/history', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idMiembro = parseInt(req.params.id);

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        const history = await fidelizacionService.getMemberHistory(idMiembro, idTenant);

        res.json({
            ok: true,
            data: history
        });

    } catch (error) {
        console.error('Error en GET /api/admin/fidelizacion/members/:id/history:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener historial'
        });
    }
});

/**
 * POST /api/admin/fidelizacion/earn
 * Sumar puntos via QR dinámico
 * Body: { qr_payload, puntos, motivo }
 */
router.post('/earn', async (req, res) => {
    try {
        const { qr_payload, puntos, motivo } = req.body;
        const userId = req.user.id;

        if (!qr_payload || !puntos || !motivo) {
            return res.status(400).json({
                ok: false,
                error: 'qr_payload, puntos y motivo son requeridos'
            });
        }

        if (puntos <= 0) {
            return res.status(400).json({
                ok: false,
                error: 'Los puntos deben ser un número positivo'
            });
        }

        const result = await fidelizacionService.validateAndEarnPoints(
            req.user.id_tenant,
            qr_payload,
            parseInt(puntos),
            motivo,
            userId
        );

        res.json({
            ok: true,
            message: `${puntos} puntos sumados correctamente`,
            data: result
        });

    } catch (error) {
        console.error('Error en POST /api/admin/fidelizacion/earn:', error);

        // Errores conocidos del servicio
        if (error.message.includes('QR') || error.message.includes('expirado') || error.message.includes('inválido')) {
            return res.status(400).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al sumar puntos'
        });
    }
});

/**
 * POST /api/admin/fidelizacion/adjust
 * Ajuste manual de puntos
 * Body: { id_miembro, puntos, motivo }
 */
router.post('/adjust', async (req, res) => {
    try {
        const { id_miembro, puntos, motivo } = req.body;
        const idTenant = req.user.id_tenant;
        const userId = req.user.id;

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        if (!id_miembro || puntos === undefined || !motivo) {
            return res.status(400).json({
                ok: false,
                error: 'id_miembro, puntos y motivo son requeridos'
            });
        }

        const result = await fidelizacionService.adjustPoints(
            parseInt(id_miembro),
            idTenant,
            parseInt(puntos),
            motivo,
            userId
        );

        res.json({
            ok: true,
            message: `Ajuste de ${puntos} puntos realizado`,
            data: result
        });

    } catch (error) {
        console.error('Error en POST /api/admin/fidelizacion/adjust:', error);

        if (error.message.includes('no encontrado')) {
            return res.status(404).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al ajustar puntos'
        });
    }
});

// ==================== PROMOS ====================

/**
 * GET /api/admin/fidelizacion/promos
 * Listar promos del tenant
 */
router.get('/promos', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const { includeInactive } = req.query;

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        const promos = await fidelizacionService.listPromos(
            idTenant,
            includeInactive === 'true'
        );

        res.json({
            ok: true,
            data: promos
        });

    } catch (error) {
        console.error('Error en GET /api/admin/fidelizacion/promos:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al listar promos'
        });
    }
});

/**
 * POST /api/admin/fidelizacion/promos
 * Crear una promo
 * Body: { titulo, descripcion?, starts_at, ends_at, activo? }
 */
router.post('/promos', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const userId = req.user.id;
        const { titulo, descripcion, starts_at, ends_at, activo } = req.body;

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        if (!titulo || !starts_at || !ends_at) {
            return res.status(400).json({
                ok: false,
                error: 'titulo, starts_at y ends_at son requeridos'
            });
        }

        const promo = await fidelizacionService.createPromo(idTenant, {
            titulo,
            descripcion,
            starts_at,
            ends_at,
            activo
        }, userId);

        res.status(201).json({
            ok: true,
            message: 'Promo creada exitosamente',
            data: promo
        });

    } catch (error) {
        console.error('Error en POST /api/admin/fidelizacion/promos:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al crear promo'
        });
    }
});

/**
 * PATCH /api/admin/fidelizacion/promos/:id
 * Actualizar una promo
 */
router.patch('/promos/:id', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idPromo = parseInt(req.params.id);
        const { titulo, descripcion, starts_at, ends_at, activo } = req.body;

        if (!idTenant) {
            return res.status(403).json({
                ok: false,
                error: 'Usuario sin tenant asignado'
            });
        }

        const promo = await fidelizacionService.updatePromo(idPromo, idTenant, {
            titulo,
            descripcion,
            starts_at,
            ends_at,
            activo
        });

        res.json({
            ok: true,
            message: 'Promo actualizada',
            data: promo
        });

    } catch (error) {
        console.error('Error en PATCH /api/admin/fidelizacion/promos/:id:', error);

        if (error.message.includes('no encontrada')) {
            return res.status(404).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al actualizar promo'
        });
    }
});

module.exports = router;
