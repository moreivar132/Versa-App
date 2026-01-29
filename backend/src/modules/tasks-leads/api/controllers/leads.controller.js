/**
 * Leads Controller
 * 
 * Handles HTTP requests for lead management and Timeline integration.
 */

const service = require('../../application/services/tasks-leads.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');

/**
 * GET /api/tasks-leads/leads
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const filters = {
            status: req.query.status,
            ownerId: req.query.ownerId ? parseInt(req.query.ownerId) : null,
            channel: req.query.channel,
            vertical: req.query.vertical,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        const leads = await service.listLeads({ tenantId }, filters);

        res.json({ ok: true, data: leads });
    } catch (error) {
        console.error('Error listing leads:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/tasks-leads/leads/:id
 */
async function getById(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const lead = await service.getLead({ tenantId }, parseInt(req.params.id));
        res.json({ ok: true, data: lead });
    } catch (error) {
        console.error('Error getting lead:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/tasks-leads/leads
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const lead = await service.createLead({ tenantId }, req.body, userId);

        res.status(201).json({ ok: true, data: lead, message: 'Lead creado correctamente' });
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * PATCH /api/tasks-leads/leads/:id
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const lead = await service.updateLead({ tenantId }, parseInt(req.params.id), req.body, userId);

        res.json({ ok: true, data: lead, message: 'Lead actualizado correctamente' });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/tasks-leads/leads/:id/close
 */
async function close(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const { status } = req.body; // 'won' | 'lost' | 'closed'
        const lead = await service.closeLead({ tenantId }, parseInt(req.params.id), status, userId);

        res.json({ ok: true, data: lead, message: 'Lead cerrado correctamente' });
    } catch (error) {
        console.error('Error closing lead:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/tasks-leads/leads/:id
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        await service.deleteLead({ tenantId }, parseInt(req.params.id), userId);

        res.json({ ok: true, message: 'Lead eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/tasks-leads/leads/:id/timeline
 */
async function getTimeline(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const result = await service.getLeadTimeline({ tenantId }, parseInt(req.params.id));
        res.json({ ok: true, data: result });
    } catch (error) {
        console.error('Error getting lead timeline:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/tasks-leads/leads/:id/link-chat
 */
async function linkChat(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const { chatId, phone } = req.body;
        if (!chatId) {
            return res.status(400).json({ ok: false, error: 'Chat ID es requerido' });
        }

        const link = await service.linkLeadToChat({ tenantId }, parseInt(req.params.id), chatId, phone);
        res.json({ ok: true, data: link, message: 'Chat vinculado correctamente' });
    } catch (error) {
        console.error('Error linking chat:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/tasks-leads/dashboard
 */
async function dashboard(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const stats = await service.getDashboardStats({ tenantId });
        res.json({ ok: true, data: stats });
    } catch (error) {
        console.error('Error getting dashboard:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/tasks-leads/timeline/pending
 * Get all unread chats from TimelinesAI (pending leads)
 */
async function getPendingChats(req, res) {
    try {
        const pendingChats = await service.getPendingChatsFromTimeline();
        res.json({ ok: true, data: pendingChats });
    } catch (error) {
        console.error('Error getting pending chats:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/tasks-leads/timeline/sync
 * Sync unread chats from TimelinesAI as new leads
 */
async function syncFromTimeline(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const result = await service.syncLeadsFromTimeline({ tenantId }, userId);

        res.json({
            ok: true,
            data: result,
            message: `Sincronización completada: ${result.created} nuevos, ${result.updated} actualizados, ${result.skipped} omitidos`
        });
    } catch (error) {
        console.error('Error syncing from timeline:', error);
        res.status(error.status || 500).json({ ok: false, error: error.message });
    }
}

async function getAllChats(req, res) {
    try {
        const chats = await service.getAllChatsFromTimeline();
        res.json({ ok: true, data: chats });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

async function getChatMessages(req, res) {
    try {
        const { id } = req.params;
        const messages = await service.getChatMessages(id);
        res.json({ ok: true, data: messages });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    list,
    getById,
    create,
    update,
    close,
    remove,
    getTimeline,
    linkChat,
    dashboard,
    getPendingChats,
    syncFromTimeline,
    getAllChats,
    getChatMessages
};
