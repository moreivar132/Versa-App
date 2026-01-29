/**
 * Tasks & Leads Service
 * 
 * Business logic layer for Tasks & Leads operations.
 */

const repo = require('../../infra/repos/tasks-leads.repo');
const timelinesService = require('../../../../../services/timelinesService');

class TasksLeadsService {
    // =========================================================
    // PROJECTS
    // =========================================================

    async listProjects(ctx, filters) {
        return repo.listProjects(ctx, filters);
    }

    async getProject(ctx, id) {
        const project = await repo.getProjectById(ctx, id);
        if (!project) {
            const error = new Error('Proyecto no encontrado');
            error.status = 404;
            throw error;
        }
        return project;
    }

    async createProject(ctx, data, userId) {
        if (!data.name || data.name.trim() === '') {
            const error = new Error('El nombre del proyecto es requerido');
            error.status = 400;
            throw error;
        }
        return repo.createProject(ctx, data, userId);
    }

    async updateProject(ctx, id, data, userId) {
        const existing = await repo.getProjectById(ctx, id);
        if (!existing) {
            const error = new Error('Proyecto no encontrado');
            error.status = 404;
            throw error;
        }
        return repo.updateProject(ctx, id, data);
    }

    async deleteProject(ctx, id, userId) {
        const existing = await repo.getProjectById(ctx, id);
        if (!existing) {
            const error = new Error('Proyecto no encontrado');
            error.status = 404;
            throw error;
        }
        return repo.deleteProject(ctx, id);
    }

    // =========================================================
    // TASKS
    // =========================================================

    async listTasks(ctx, filters) {
        return repo.listTasks(ctx, filters);
    }

    async getTask(ctx, id) {
        const task = await repo.getTaskById(ctx, id);
        if (!task) {
            const error = new Error('Tarea no encontrada');
            error.status = 404;
            throw error;
        }
        return task;
    }

    async createTask(ctx, data, userId) {
        if (!data.title || data.title.trim() === '') {
            const error = new Error('El título de la tarea es requerido');
            error.status = 400;
            throw error;
        }
        if (!data.project_id) {
            const error = new Error('El proyecto es requerido');
            error.status = 400;
            throw error;
        }
        return repo.createTask(ctx, data, userId);
    }

    async updateTask(ctx, id, data, userId) {
        const existing = await repo.getTaskById(ctx, id);
        if (!existing) {
            const error = new Error('Tarea no encontrada');
            error.status = 404;
            throw error;
        }
        return repo.updateTask(ctx, id, data);
    }

    async deleteTask(ctx, id, userId) {
        const existing = await repo.getTaskById(ctx, id);
        if (!existing) {
            const error = new Error('Tarea no encontrada');
            error.status = 404;
            throw error;
        }
        return repo.deleteTask(ctx, id);
    }

    // =========================================================
    // LEADS
    // =========================================================

    async listLeads(ctx, filters) {
        return repo.listLeads(ctx, filters);
    }

    async getLead(ctx, id) {
        const lead = await repo.getLeadById(ctx, id);
        if (!lead) {
            const error = new Error('Lead no encontrado');
            error.status = 404;
            throw error;
        }
        return lead;
    }

    async createLead(ctx, data, userId) {
        // At least one identifier is required
        if (!data.full_name && !data.company && !data.phone && !data.email) {
            const error = new Error('Se requiere al menos un identificador (nombre, empresa, teléfono o email)');
            error.status = 400;
            throw error;
        }
        return repo.createLead(ctx, data, userId);
    }

    async updateLead(ctx, id, data, userId) {
        const existing = await repo.getLeadById(ctx, id);
        if (!existing) {
            const error = new Error('Lead no encontrado');
            error.status = 404;
            throw error;
        }
        return repo.updateLead(ctx, id, data);
    }

    async closeLead(ctx, id, status, userId) {
        if (!['won', 'lost', 'closed'].includes(status)) {
            const error = new Error('Estado de cierre inválido');
            error.status = 400;
            throw error;
        }
        return repo.updateLead(ctx, id, { status, last_activity_at: new Date() });
    }

    async deleteLead(ctx, id, userId) {
        const existing = await repo.getLeadById(ctx, id);
        if (!existing) {
            const error = new Error('Lead no encontrado');
            error.status = 404;
            throw error;
        }
        return repo.deleteLead(ctx, id);
    }

    // =========================================================
    // TIMELINE INTEGRATION
    // =========================================================

    async getLeadTimeline(ctx, leadId) {
        const lead = await repo.getLeadById(ctx, leadId);
        if (!lead) {
            const error = new Error('Lead no encontrado');
            error.status = 404;
            throw error;
        }

        // If no timeline link or no phone, return empty
        if (!lead.timeline_external_id && !lead.phone) {
            return { lead, messages: [], meta: { synced: false, reason: 'No hay chat de Timeline vinculado' } };
        }

        try {
            // Try to get messages from TimelinesAI
            const chatId = lead.timeline_external_id;
            if (chatId) {
                const messages = await timelinesService.getChatMessages(chatId);
                await repo.updateTimelineSyncTime(ctx, leadId);
                return { lead, messages: messages || [], meta: { synced: true, lastSync: new Date() } };
            }

            return { lead, messages: [], meta: { synced: false, reason: 'Chat ID no configurado' } };
        } catch (error) {
            console.error('Error fetching timeline:', error);
            return { lead, messages: [], meta: { synced: false, error: error.message } };
        }
    }

    async linkLeadToChat(ctx, leadId, chatId, phone) {
        const lead = await repo.getLeadById(ctx, leadId);
        if (!lead) {
            const error = new Error('Lead no encontrado');
            error.status = 404;
            throw error;
        }

        return repo.linkLeadToTimeline(ctx, leadId, chatId, phone || lead.phone);
    }

    // =========================================================
    // DASHBOARD
    // =========================================================

    async getDashboardStats(ctx) {
        return repo.getDashboardStats(ctx);
    }

    // =========================================================
    // TIMELINE SYNC (Import leads from TimelinesAI)
    // =========================================================

    /**
     * Get ALL chats from TimelinesAI (for history view)
     */
    async getAllChatsFromTimeline(limit = 50) {
        if (!timelinesService.isConfigured()) return [];
        const response = await timelinesService.getAllChats({ limit });
        return (response?.data?.chats || []).map(chat => ({
            timeline_id: chat.id,
            phone: chat.phone,
            full_name: chat.name !== chat.phone ? chat.name : null,
            last_message_at: chat.last_message_timestamp ? new Date(chat.last_message_timestamp) : null,
            responsible: chat.whatsapp_account?.name || null, // Assuming this structure or similar
            labels: chat.labels || [],
            is_group: chat.is_group,
            chat_url: chat.chat_url,
            is_read: chat.is_read // Assuming available
        }));
    }

    /**
     * Get messages for a specific chat
     */
    async getChatMessages(chatId) {
        if (!timelinesService.isConfigured()) throw new Error('TimelinesAI no configurado');
        const response = await timelinesService.getChatMessages(chatId, 50);
        return response?.data?.messages || [];
    }

    /**
     * Get pending (unread) chats from TimelinesAI
     * @returns {Promise<Array>} - Array of pending chats formatted as potential leads
     */
    async getPendingChatsFromTimeline() {
        if (!timelinesService.isConfigured()) {
            const error = new Error('TimelinesAI no está configurado');
            error.status = 503;
            throw error;
        }

        const chats = await timelinesService.getUnreadChats(100);

        // Transform to lead-like format for frontend
        return chats.map(chat => ({
            timeline_id: chat.id,
            phone: chat.phone,
            full_name: chat.name !== chat.phone ? chat.name : null,
            channel: 'whatsapp',
            last_message_at: chat.last_message_timestamp,
            created_at: chat.created_timestamp,
            responsible: chat.responsible_name,
            labels: chat.labels || [],
            photo: chat.photo,
            is_group: chat.is_group,
            chat_url: chat.chat_url
        }));
    }

    /**
     * Sync unread chats from TimelinesAI as leads
     * Creates new leads or updates existing ones linked to the chat
     * @param {Object} ctx - Tenant context
     * @param {number} userId - User performing the sync
     * @returns {Promise<{created: number, updated: number, skipped: number, leads: Array}>}
     */
    async syncLeadsFromTimeline(ctx, userId) {
        if (!timelinesService.isConfigured()) {
            const error = new Error('TimelinesAI no está configurado');
            error.status = 503;
            throw error;
        }

        const chats = await timelinesService.getUnreadChats(100);
        const result = { created: 0, updated: 0, skipped: 0, leads: [] };

        for (const chat of chats) {
            try {
                // Skip groups
                if (chat.is_group) {
                    result.skipped++;
                    continue;
                }

                // Check if lead already exists with this phone or timeline_id
                const existingLead = await repo.findLeadByPhoneOrTimelineId(ctx, chat.phone, String(chat.id));

                if (existingLead) {
                    // Update last activity
                    await repo.updateLead(ctx, existingLead.id, {
                        last_activity_at: chat.last_message_timestamp || new Date()
                    });
                    result.updated++;
                    result.leads.push(existingLead);
                } else {
                    // Create new lead
                    const newLead = await repo.createLead(ctx, {
                        full_name: chat.name !== chat.phone ? chat.name : null,
                        phone: chat.phone,
                        channel: 'whatsapp',
                        status: 'new',
                        notes: `Importado desde TimelinesAI. Chat ID: ${chat.id}`
                    }, userId);

                    // Link to timeline
                    await repo.linkLeadToTimeline(ctx, newLead.id, String(chat.id), chat.phone);

                    result.created++;
                    result.leads.push(newLead);
                }
            } catch (error) {
                console.error(`Error syncing chat ${chat.id}:`, error);
                result.skipped++;
            }
        }

        return result;
    }
}

module.exports = new TasksLeadsService();
