/**
 * Projects Controller
 * 
 * Handles HTTP requests for project management.
 */

const service = require('../../application/services/tasks-leads.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');

/**
 * GET /api/tasks-leads/projects
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const filters = {
            status: req.query.status || 'active',
            branchId: req.query.branchId,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const projects = await service.listProjects({ tenantId }, filters);

        res.json({ ok: true, data: projects });
    } catch (error) {
        console.error('Error listing projects:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/tasks-leads/projects/:id
 */
async function getById(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const project = await service.getProject({ tenantId }, parseInt(req.params.id));
        res.json({ ok: true, data: project });
    } catch (error) {
        console.error('Error getting project:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/tasks-leads/projects
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const project = await service.createProject({ tenantId }, req.body, userId);

        res.status(201).json({ ok: true, data: project, message: 'Proyecto creado correctamente' });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * PATCH /api/tasks-leads/projects/:id
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const project = await service.updateProject({ tenantId }, parseInt(req.params.id), req.body, userId);

        res.json({ ok: true, data: project, message: 'Proyecto actualizado correctamente' });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/tasks-leads/projects/:id
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        await service.deleteProject({ tenantId }, parseInt(req.params.id), userId);

        res.json({ ok: true, message: 'Proyecto eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

module.exports = { list, getById, create, update, remove };
