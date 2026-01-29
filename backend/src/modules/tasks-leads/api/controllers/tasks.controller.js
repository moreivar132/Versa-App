/**
 * Tasks Controller
 * 
 * Handles HTTP requests for task management.
 */

const service = require('../../application/services/tasks-leads.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');

/**
 * GET /api/tasks-leads/tasks
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const filters = {
            projectId: req.query.projectId ? parseInt(req.query.projectId) : null,
            status: req.query.status,
            assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo) : null,
            overdue: req.query.overdue === 'true',
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const tasks = await service.listTasks({ tenantId }, filters);

        res.json({ ok: true, data: tasks });
    } catch (error) {
        console.error('Error listing tasks:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/tasks-leads/tasks/:id
 */
async function getById(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const task = await service.getTask({ tenantId }, parseInt(req.params.id));
        res.json({ ok: true, data: task });
    } catch (error) {
        console.error('Error getting task:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/tasks-leads/tasks
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const task = await service.createTask({ tenantId }, req.body, userId);

        res.status(201).json({ ok: true, data: task, message: 'Tarea creada correctamente' });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * PATCH /api/tasks-leads/tasks/:id
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const task = await service.updateTask({ tenantId }, parseInt(req.params.id), req.body, userId);

        res.json({ ok: true, data: task, message: 'Tarea actualizada correctamente' });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/tasks-leads/tasks/:id
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        await service.deleteTask({ tenantId }, parseInt(req.params.id), userId);

        res.json({ ok: true, message: 'Tarea eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

module.exports = { list, getById, create, update, remove };
