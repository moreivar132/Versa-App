/**
 * Contactos Controller
 * CRUD de contactos fiscales
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');
const auditService = require('../../../../core/logging/audit-service');
const { AUDIT_ACTIONS } = auditService;

/**
 * Helper para obtener empresa ID
 */
function getEmpresaId(req) {
    const val = req.headers['x-empresa-id'] || req.query.empresaId;
    return val === '' ? null : val;
}

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
            idEmpresa: getEmpresaId(req),
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const contactos = await service.listContactos({ tenantId }, filters);

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
        const contacto = await service.getContacto({ tenantId }, id);

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
 * GET /api/contabilidad/contactos/by-nif/:nif
 * Find contact by NIF/CIF
 */
async function findByNif(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const nif = req.params.nif;
        if (!nif) {
            return res.status(400).json({ ok: false, error: 'NIF/CIF requerido' });
        }

        const contacto = await service.findContactoByNif({ tenantId }, nif);

        if (!contacto) {
            return res.status(404).json({
                ok: false,
                error: 'Contacto no encontrado',
                code: 'NOT_FOUND'
            });
        }

        res.json({
            ok: true,
            data: contacto
        });
    } catch (error) {
        console.error('Error en findByNif contacto:', error);
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
        if (!data.tipo || !['PROVEEDOR', 'CLIENTE', 'AMBOS'].includes(data.tipo)) {
            return res.status(400).json({ ok: false, error: 'Tipo de contacto inválido' });
        }

        // Obtener empresa del contexto (header o query param)
        const empresaId = getEmpresaId(req);

        // Asignar empresa si existe en contexto
        if (empresaId) {
            data.id_empresa = empresaId;
        }

        // Sanitizar campos numéricos opcionales
        if (data.id_empresa === '') data.id_empresa = null;

        if (!data.nombre) {
            return res.status(400).json({ ok: false, error: 'Nombre requerido' });
        }

        const contacto = await service.createContacto({ tenantId }, data, userId);

        // Audit Log
        auditService.register(req, AUDIT_ACTIONS.CONTACTO_CREATE, {
            entityType: 'CONTACTO',
            entityId: contacto.id,
            after: contacto
        });

        res.status(201).json({
            ok: true,
            data: contacto,
            message: 'Contacto creado correctamente'
        });
    } catch (error) {
        console.error('Error en create contacto:', error);

        // Handle duplicate NIF error
        if (error.code === 'DUPLICATE_NIF') {
            return res.status(409).json({
                ok: false,
                error: error.message,
                code: 'DUPLICATE_NIF',
                existingContact: error.existingContact
            });
        }

        if (error.code === '23505') {
            return res.status(409).json({
                ok: false,
                error: 'Ya existe un contacto con ese NIF/CIF',
                code: 'DUPLICATE_NIF'
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

        // Get old data for audit before updating
        const oldContacto = await service.getContacto({ tenantId }, id);
        const contacto = await service.updateContacto({ tenantId }, id, data, userId);

        // Audit Log
        auditService.register(req, AUDIT_ACTIONS.CONTACTO_UPDATE, {
            entityType: 'CONTACTO',
            entityId: id,
            before: oldContacto,
            after: contacto
        });

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

        // Get data for audit before deleting
        const oldContacto = await service.getContacto({ tenantId }, id);
        await service.deleteContacto({ tenantId }, id, userId);

        // Audit Log
        auditService.register(req, AUDIT_ACTIONS.CONTACTO_DELETE, {
            entityType: 'CONTACTO',
            entityId: id,
            before: oldContacto
        });

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
    findByNif,
    create,
    update,
    remove
};
