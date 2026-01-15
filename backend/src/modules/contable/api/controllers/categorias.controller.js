/**
 * Categorías Controller
 * Gestión de categorías contables
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');

/**
 * GET /api/contabilidad/categorias
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const filters = {
            tipo: req.query.tipo,
            activo: req.query.activo !== 'false'
        };

        const categorias = await service.listCategorias({ tenantId }, filters);

        res.json({
            ok: true,
            data: categorias
        });
    } catch (error) {
        console.error('Error en list categorias:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * POST /api/contabilidad/categorias
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const data = req.body;

        // Validaciones
        if (!data.codigo) {
            return res.status(400).json({ ok: false, error: 'Código requerido' });
        }

        if (!data.nombre) {
            return res.status(400).json({ ok: false, error: 'Nombre requerido' });
        }

        if (!data.tipo || !['INGRESO', 'GASTO'].includes(data.tipo)) {
            return res.status(400).json({ ok: false, error: 'Tipo inválido (INGRESO/GASTO)' });
        }

        const categoria = await service.createCategoria({ tenantId }, data, userId);

        res.status(201).json({
            ok: true,
            data: categoria,
            message: 'Categoría creada correctamente'
        });
    } catch (error) {
        console.error('Error en create categoria:', error);

        if (error.code === '23505') {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe una categoría con ese código'
            });
        }

        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * PATCH /api/contabilidad/categorias/:id
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const data = req.body;

        const categoria = await service.updateCategoria({ tenantId }, id, data);

        if (!categoria) {
            return res.status(404).json({ ok: false, error: 'Categoría no encontrada' });
        }

        res.json({
            ok: true,
            data: categoria,
            message: 'Categoría actualizada correctamente'
        });
    } catch (error) {
        console.error('Error en update categoria:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * DELETE /api/contabilidad/categorias/:id
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);

        await service.deleteCategoria({ tenantId }, id);

        res.json({
            ok: true,
            message: 'Categoría desactivada correctamente'
        });
    } catch (error) {
        console.error('Error en remove categoria:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    list,
    create,
    update,
    remove
};
