/**
 * Contactos Controller
 * CRUD de contactos fiscales
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../middleware/rbac');

/**
 * GET /api/contabilidad/contactos
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const filters = {
            tipo: req.query.tipo,
            activo: req.query.activo !== 'false',
            search: req.query.search,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const contactos = await service.listContactos(tenantId, filters);

        res.json({
            ok: true,
            data: contactos
        });
    } catch (error) {
        console.error('Error en list contactos:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/contactos/:id
 */
async function getById(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const contacto = await service.getContacto(tenantId, id);

        res.json({
            ok: true,
            data: contacto
        });
    } catch (error) {
        console.error('Error en getById contacto:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * POST /api/contabilidad/contactos
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const data = req.body;

        // Validaciones básicas
        if (!data.tipo || !['PROVEEDOR', 'CLIENTE'].includes(data.tipo)) {
            return res.status(400).json({ ok: false, error: 'Tipo de contacto inválido' });
        }

        if (!data.nombre) {
            return res.status(400).json({ ok: false, error: 'Nombre requerido' });
        }

        const contacto = await service.createContacto(tenantId, data, userId);

        res.status(201).json({
            ok: true,
            data: contacto,
            message: 'Contacto creado correctamente'
        });
    } catch (error) {
        console.error('Error en create contacto:', error);

        // Handle duplicate NIF error
        if (error.code === '23505') {
            return res.status(400).json({
                ok: false,
                error: 'Ya existe un contacto con ese NIF/CIF'
            });
        }

        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * PATCH /api/contabilidad/contactos/:id
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const userId = req.user?.id;
        const data = req.body;

        const contacto = await service.updateContacto(tenantId, id, data, userId);

        res.json({
            ok: true,
            data: contacto,
            message: 'Contacto actualizado correctamente'
        });
    } catch (error) {
        console.error('Error en update contacto:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * DELETE /api/contabilidad/contactos/:id
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const userId = req.user?.id;

        await service.deleteContacto(tenantId, id, userId);

        res.json({
            ok: true,
            message: 'Contacto eliminado correctamente'
        });
    } catch (error) {
        console.error('Error en remove contacto:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove
};
