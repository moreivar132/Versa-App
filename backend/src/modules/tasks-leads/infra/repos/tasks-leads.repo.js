/**
 * Tasks & Leads Repository
 * 
 * Data access layer for projects, tasks, leads, and timeline links.
 */

const { getTenantDb } = require('../../../../core/db/tenant-db');

class TasksLeadsRepository {
    // =========================================================
    // PROJECTS
    // =========================================================

    async listProjects(ctx, filters = {}) {
        const db = getTenantDb(ctx);
        const { status = 'active', branchId, limit = 100, offset = 0 } = filters;

        let query = `
            SELECT 
                p.*,
                u.nombre as created_by_name,
                (SELECT COUNT(*) FROM tasksleads_task t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as task_count
            FROM tasksleads_project p
            LEFT JOIN usuario u ON p.created_by = u.id
            WHERE p.id_tenant = $1 AND p.deleted_at IS NULL
        `;
        const params = [ctx.tenantId];
        let paramIndex = 2;

        if (status && status !== 'all') {
            query += ` AND p.status = $${paramIndex++}`;
            params.push(status);
        }

        if (branchId) {
            query += ` AND p.branch_id = $${paramIndex++}`;
            params.push(branchId);
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    }

    async getProjectById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT p.*, u.nombre as created_by_name
            FROM tasksleads_project p
            LEFT JOIN usuario u ON p.created_by = u.id
            WHERE p.id = $1 AND p.id_tenant = $2 AND p.deleted_at IS NULL
        `, [id, ctx.tenantId]);
        return result.rows[0] || null;
    }

    async createProject(ctx, data, userId) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            INSERT INTO tasksleads_project (id_tenant, branch_id, name, description, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [ctx.tenantId, data.branch_id || null, data.name, data.description || null, data.status || 'active', userId]);
        return result.rows[0];
    }

    async updateProject(ctx, id, data) {
        const db = getTenantDb(ctx);
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (data.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(data.name); }
        if (data.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(data.description); }
        if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }
        if (data.branch_id !== undefined) { fields.push(`branch_id = $${paramIndex++}`); values.push(data.branch_id); }

        fields.push(`updated_at = NOW()`);

        values.push(id, ctx.tenantId);

        const result = await db.query(`
            UPDATE tasksleads_project 
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex++} AND id_tenant = $${paramIndex++} AND deleted_at IS NULL
            RETURNING *
        `, values);
        return result.rows[0];
    }

    async deleteProject(ctx, id) {
        const db = getTenantDb(ctx);
        await db.query(`
            UPDATE tasksleads_project SET deleted_at = NOW() 
            WHERE id = $1 AND id_tenant = $2
        `, [id, ctx.tenantId]);
    }

    // =========================================================
    // TASKS
    // =========================================================

    async listTasks(ctx, filters = {}) {
        const db = getTenantDb(ctx);
        const { projectId, status, assignedTo, overdue, limit = 100, offset = 0 } = filters;

        let query = `
            SELECT 
                t.*,
                u.nombre as assigned_to_name,
                p.name as project_name
            FROM tasksleads_task t
            LEFT JOIN usuario u ON t.assigned_to_user_id = u.id
            LEFT JOIN tasksleads_project p ON t.project_id = p.id
            WHERE t.id_tenant = $1 AND t.deleted_at IS NULL
        `;
        const params = [ctx.tenantId];
        let paramIndex = 2;

        if (projectId) {
            query += ` AND t.project_id = $${paramIndex++}`;
            params.push(projectId);
        }

        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            params.push(status);
        }

        if (assignedTo) {
            query += ` AND t.assigned_to_user_id = $${paramIndex++}`;
            params.push(assignedTo);
        }

        if (overdue === true) {
            query += ` AND t.due_date < CURRENT_DATE AND t.status != 'done'`;
        }

        query += ` ORDER BY t.priority DESC, t.due_date ASC NULLS LAST, t.created_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    }

    async getTaskById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT t.*, u.nombre as assigned_to_name, p.name as project_name
            FROM tasksleads_task t
            LEFT JOIN usuario u ON t.assigned_to_user_id = u.id
            LEFT JOIN tasksleads_project p ON t.project_id = p.id
            WHERE t.id = $1 AND t.id_tenant = $2 AND t.deleted_at IS NULL
        `, [id, ctx.tenantId]);
        return result.rows[0] || null;
    }

    async createTask(ctx, data, userId) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            INSERT INTO tasksleads_task 
                (id_tenant, project_id, branch_id, title, description, status, priority, due_date, assigned_to_user_id, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            ctx.tenantId,
            data.project_id,
            data.branch_id || null,
            data.title,
            data.description || null,
            data.status || 'todo',
            data.priority || 'medium',
            data.due_date || null,
            data.assigned_to_user_id || null,
            userId
        ]);
        return result.rows[0];
    }

    async updateTask(ctx, id, data) {
        const db = getTenantDb(ctx);
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (data.title !== undefined) { fields.push(`title = $${paramIndex++}`); values.push(data.title); }
        if (data.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(data.description); }
        if (data.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }
        if (data.priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(data.priority); }
        if (data.due_date !== undefined) { fields.push(`due_date = $${paramIndex++}`); values.push(data.due_date); }
        if (data.assigned_to_user_id !== undefined) { fields.push(`assigned_to_user_id = $${paramIndex++}`); values.push(data.assigned_to_user_id); }
        if (data.project_id !== undefined) { fields.push(`project_id = $${paramIndex++}`); values.push(data.project_id); }

        fields.push(`updated_at = NOW()`);
        values.push(id, ctx.tenantId);

        const result = await db.query(`
            UPDATE tasksleads_task 
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex++} AND id_tenant = $${paramIndex++} AND deleted_at IS NULL
            RETURNING *
        `, values);
        return result.rows[0];
    }

    async deleteTask(ctx, id) {
        const db = getTenantDb(ctx);
        await db.query(`
            UPDATE tasksleads_task SET deleted_at = NOW() 
            WHERE id = $1 AND id_tenant = $2
        `, [id, ctx.tenantId]);
    }

    // =========================================================
    // LEADS
    // =========================================================

    async listLeads(ctx, filters = {}) {
        const db = getTenantDb(ctx);
        const { status, ownerId, channel, vertical, limit = 100, offset = 0 } = filters;

        let query = `
            SELECT 
                l.*,
                u.nombre as owner_name,
                tl.timeline_external_id,
                tl.last_sync_at as timeline_last_sync,
                (SELECT json_agg(tag) FROM tasksleads_lead_tag WHERE lead_id = l.id) as tags,
                ai.categoria_principal as ai_category,
                ai.urgencia as ai_urgency,
                ai.resumen as ai_summary
            FROM tasksleads_lead l
            LEFT JOIN usuario u ON l.owner_user_id = u.id
            LEFT JOIN tasksleads_lead_timeline_link tl ON l.id = tl.lead_id
            LEFT JOIN tasksleads_lead_ai ai ON l.id = ai.lead_id
            WHERE l.id_tenant = $1 AND l.deleted_at IS NULL
        `;
        const params = [ctx.tenantId];
        let paramIndex = 2;

        if (status) {
            query += ` AND l.status = $${paramIndex++}`;
            params.push(status);
        }

        if (ownerId) {
            query += ` AND l.owner_user_id = $${paramIndex++}`;
            params.push(ownerId);
        }

        if (channel) {
            query += ` AND l.channel = $${paramIndex++}`;
            params.push(channel);
        }

        if (vertical) {
            query += ` AND l.interested_vertical = $${paramIndex++}`;
            params.push(vertical);
        }

        query += ` ORDER BY l.last_activity_at DESC NULLS LAST, l.created_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    }

    async getLeadById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT 
                l.*,
                u.nombre as owner_name,
                tl.timeline_external_id,
                tl.timeline_phone,
                tl.last_sync_at as timeline_last_sync,
                (SELECT json_agg(tag) FROM tasksleads_lead_tag WHERE lead_id = l.id) as tags,
                ai.categoria_principal as ai_category,
                ai.urgencia as ai_urgency,
                ai.resumen as ai_summary,
                ai.intencion as ai_intention
            FROM tasksleads_lead l
            LEFT JOIN usuario u ON l.owner_user_id = u.id
            LEFT JOIN tasksleads_lead_timeline_link tl ON l.id = tl.lead_id
            LEFT JOIN tasksleads_lead_ai ai ON l.id = ai.lead_id
            WHERE l.id = $1 AND l.id_tenant = $2 AND l.deleted_at IS NULL
        `, [id, ctx.tenantId]);
        return result.rows[0] || null;
    }

    async createLead(ctx, data, userId) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            INSERT INTO tasksleads_lead 
                (id_tenant, branch_id, full_name, company, phone, email, channel, status, interested_vertical, owner_user_id, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            ctx.tenantId,
            data.branch_id || null,
            data.full_name || null,
            data.company || null,
            data.phone || null,
            data.email || null,
            data.channel || 'other',
            data.status || 'new',
            data.interested_vertical || null,
            data.owner_user_id || userId,
            data.notes || null,
            userId
        ]);
        return result.rows[0];
    }

    async updateLead(ctx, id, data) {
        const db = getTenantDb(ctx);
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = ['full_name', 'company', 'phone', 'email', 'channel', 'status', 'interested_vertical', 'owner_user_id', 'notes', 'last_activity_at'];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = $${paramIndex++}`);
                values.push(data[field]);
            }
        }

        fields.push(`updated_at = NOW()`);
        values.push(id, ctx.tenantId);

        const result = await db.query(`
            UPDATE tasksleads_lead 
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex++} AND id_tenant = $${paramIndex++} AND deleted_at IS NULL
            RETURNING *
        `, values);
        return result.rows[0];
    }

    async deleteLead(ctx, id) {
        const db = getTenantDb(ctx);
        await db.query(`
            UPDATE tasksleads_lead SET deleted_at = NOW() 
            WHERE id = $1 AND id_tenant = $2
        `, [id, ctx.tenantId]);
    }

    // =========================================================
    // TIMELINE LINKS
    // =========================================================

    async linkLeadToTimeline(ctx, leadId, externalId, phone) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            INSERT INTO tasksleads_lead_timeline_link (id_tenant, lead_id, timeline_external_id, timeline_phone)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (lead_id) DO UPDATE SET
                timeline_external_id = EXCLUDED.timeline_external_id,
                timeline_phone = EXCLUDED.timeline_phone,
                last_sync_at = NOW()
            RETURNING *
        `, [ctx.tenantId, leadId, externalId, phone]);
        return result.rows[0];
    }

    async updateTimelineSyncTime(ctx, leadId) {
        const db = getTenantDb(ctx);
        await db.query(`
            UPDATE tasksleads_lead_timeline_link SET last_sync_at = NOW()
            WHERE lead_id = $1 AND id_tenant = $2
        `, [leadId, ctx.tenantId]);
    }

    // =========================================================
    // DASHBOARD STATS
    // =========================================================

    async getDashboardStats(ctx) {
        const db = getTenantDb(ctx);

        const result = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM tasksleads_project WHERE id_tenant = $1 AND deleted_at IS NULL AND status = 'active') as active_projects,
                (SELECT COUNT(*) FROM tasksleads_task WHERE id_tenant = $1 AND deleted_at IS NULL AND status = 'todo') as todo_tasks,
                (SELECT COUNT(*) FROM tasksleads_task WHERE id_tenant = $1 AND deleted_at IS NULL AND status = 'doing') as doing_tasks,
                (SELECT COUNT(*) FROM tasksleads_task WHERE id_tenant = $1 AND deleted_at IS NULL AND due_date < CURRENT_DATE AND status != 'done') as overdue_tasks,
                (SELECT COUNT(*) FROM tasksleads_lead WHERE id_tenant = $1 AND deleted_at IS NULL AND status IN ('new', 'open', 'followup')) as open_leads,
                (SELECT COUNT(*) FROM tasksleads_lead WHERE id_tenant = $1 AND deleted_at IS NULL AND status = 'won') as won_leads,
                (SELECT COUNT(*) FROM tasksleads_lead WHERE id_tenant = $1 AND deleted_at IS NULL AND status = 'lost') as lost_leads
        `, [ctx.tenantId]);

        return result.rows[0];
    }

    // =========================================================
    // TIMELINE SYNC HELPERS
    // =========================================================

    /**
     * Find a lead by phone or timeline external ID
     * @param {Object} ctx - Tenant context
     * @param {string} phone - Phone number to search
     * @param {string} timelineId - Timeline external ID to search
     * @returns {Promise<Object|null>} - Found lead or null
     */
    async findLeadByPhoneOrTimelineId(ctx, phone, timelineId) {
        const db = getTenantDb(ctx);

        const result = await db.query(`
            SELECT l.*, tl.timeline_external_id
            FROM tasksleads_lead l
            LEFT JOIN tasksleads_lead_timeline_link tl ON l.id = tl.lead_id
            WHERE l.id_tenant = $1 
              AND l.deleted_at IS NULL
              AND (l.phone = $2 OR tl.timeline_external_id = $3)
            LIMIT 1
        `, [ctx.tenantId, phone, timelineId]);

        return result.rows[0] || null;
    }
}

module.exports = new TasksLeadsRepository();
