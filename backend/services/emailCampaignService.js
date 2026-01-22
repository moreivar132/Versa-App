/**
 * VERSA - Email Campaign Service
 * Gestión de campañas de email programables
 */

// const pool = require('../db'); // REMOVED
const { getTenantDb } = require('../src/core/db/tenant-db');
const emailAutomationService = require('./emailAutomationService');

class EmailCampaignService {

    /**
     * Helper to resolve DB and Tenant ID from variable arguments
     */
    _resolveDb(arg1, arg2) {
        if (arg1 && (arg1.tenantId || arg1.query)) {
            // arg1 is Context/DB
            return { db: getTenantDb(arg1), tenantId: arg1.tenantId || arg1.id_tenant };
        }
        // Legacy: arg1 is ID or something else, arg2 is ID Tenant?
        // Wait, for methods like createCampaign(idTenant, data), arg1 is idTenant.
        // For getCampaign(id, idTenant), arg2 is idTenant.
        // We need specific handling per method or a generic strategy.
        // Let's rely on specific handling in each method for safety.
        return null;
    }

    /**
     * Crear una nueva campaña en estado borrador
     * Signature: (ctx, data) OR (idTenant, data)
     */
    async createCampaign(ctxOrId, data) {
        let db, tenantId;
        if (ctxOrId && (ctxOrId.tenantId || ctxOrId.query)) {
            db = getTenantDb(ctxOrId);
            tenantId = ctxOrId.tenantId;
        } else {
            tenantId = ctxOrId;
            db = getTenantDb({ tenantId });
        }

        const {
            nombre,
            tipo = 'manual',
            id_promo = null,
            template_code = null,
            subject,
            html_body,
            preview_text = null,
            recipient_filter = { type: 'all_members' },
            created_by = null
        } = data;

        const result = await db.query(`
            INSERT INTO email_campaign 
            (id_tenant, nombre, tipo, id_promo, template_code, subject, html_body, preview_text, recipient_filter, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [tenantId, nombre, tipo, id_promo, template_code, subject, html_body, preview_text, JSON.stringify(recipient_filter), created_by]);

        // Calculate initial recipient count
        const campaign = result.rows[0];
        const count = await this.countRecipients(db, tenantId, recipient_filter);
        await db.query('UPDATE email_campaign SET total_recipients = $1 WHERE id = $2', [count, campaign.id]);
        campaign.total_recipients = count;

        return campaign;
    }

    /**
     * Obtener campaña por ID
     * Signature: (ctx, id) OR (id, idTenant)
     */
    async getCampaign(ctxOrId, idOrTenant) {
        let db, tenantId, campaignId;

        if (ctxOrId && (ctxOrId.tenantId || ctxOrId.query)) {
            // (ctx, id)
            db = getTenantDb(ctxOrId);
            tenantId = ctxOrId.tenantId;
            campaignId = idOrTenant;
        } else {
            // (id, idTenant)
            campaignId = ctxOrId;
            tenantId = idOrTenant;
            db = getTenantDb({ tenantId });
        }

        const result = await db.query(`
            SELECT c.*, p.titulo as promo_titulo
            FROM email_campaign c
            LEFT JOIN fidelizacion_promo p ON p.id = c.id_promo
            WHERE c.id = $1 AND c.id_tenant = $2
        `, [campaignId, tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Listar campañas del tenant
     * Signature: (ctx, status, limit) OR (idTenant, status, limit)
     */
    async listCampaigns(ctxOrId, status = null, limit = 50) {
        let db, tenantId;
        if (ctxOrId && (ctxOrId.tenantId || ctxOrId.query)) {
            db = getTenantDb(ctxOrId);
            tenantId = ctxOrId.tenantId;
        } else {
            tenantId = ctxOrId;
            db = getTenantDb({ tenantId });
        }

        let query = `
            SELECT c.*, p.titulo as promo_titulo
            FROM email_campaign c
            LEFT JOIN fidelizacion_promo p ON p.id = c.id_promo
            WHERE c.id_tenant = $1
        `;
        const params = [tenantId];

        if (status) {
            query += ' AND c.status = $2';
            params.push(status);
        }

        query += ' ORDER BY c.created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Actualizar campaña (solo borradores)
     * Signature: (ctx, id, data) OR (id, idTenant, data)
     */
    async updateCampaign(arg1, arg2, arg3) {
        let db, tenantId, campaignId, data;

        if (arg1 && (arg1.tenantId || arg1.query)) {
            // (ctx, id, data)
            db = getTenantDb(arg1);
            tenantId = arg1.tenantId;
            campaignId = arg2;
            data = arg3;
        } else {
            // (id, idTenant, data)
            campaignId = arg1;
            tenantId = arg2;
            data = arg3;
            db = getTenantDb({ tenantId });
        }

        const { nombre, subject, html_body, preview_text, recipient_filter } = data;

        // Verify campaign exists and is draft
        // Reuse getCampaign logic? We need db instance.
        // We can just query directly.

        const existingResult = await db.query(`
            SELECT c.*
            FROM email_campaign c
            WHERE c.id = $1 AND c.id_tenant = $2
        `, [campaignId, tenantId]);
        const existing = existingResult.rows[0];

        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status !== 'draft') throw new Error('Solo se pueden editar campañas en borrador');

        const result = await db.query(`
            UPDATE email_campaign SET
                nombre = COALESCE($1, nombre),
                subject = COALESCE($2, subject),
                html_body = COALESCE($3, html_body),
                preview_text = COALESCE($4, preview_text),
                recipient_filter = COALESCE($5, recipient_filter),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND id_tenant = $7
            RETURNING *
        `, [nombre, subject, html_body, preview_text, recipient_filter ? JSON.stringify(recipient_filter) : null, campaignId, tenantId]);

        // Recalculate recipient count if filter changed
        if (recipient_filter) {
            const count = await this.countRecipients(db, tenantId, recipient_filter);
            await db.query('UPDATE email_campaign SET total_recipients = $1 WHERE id = $2', [count, campaignId]);
        }

        return result.rows[0];
    }

    /**
     * Programar envío de campaña
     * Signature: (ctx, id, scheduledAt) OR (id, idTenant, scheduledAt)
     */
    async scheduleCampaign(arg1, arg2, arg3) {
        let db, tenantId, campaignId, scheduledAt;

        if (arg1 && (arg1.tenantId || arg1.query)) {
            // (ctx, id, scheduledAt)
            db = getTenantDb(arg1);
            tenantId = arg1.tenantId;
            campaignId = arg2;
            scheduledAt = arg3;
        } else {
            // (id, idTenant, scheduledAt)
            campaignId = arg1;
            tenantId = arg2;
            scheduledAt = arg3;
            db = getTenantDb({ tenantId });
        }

        const existingResult = await db.query('SELECT status FROM email_campaign WHERE id = $1 AND id_tenant = $2', [campaignId, tenantId]);
        const existing = existingResult.rows[0];

        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status !== 'draft') throw new Error('Solo se pueden programar campañas en borrador');

        const result = await db.query(`
            UPDATE email_campaign SET
                status = 'scheduled',
                scheduled_at = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND id_tenant = $3
            RETURNING *
        `, [scheduledAt, campaignId, tenantId]);

        return result.rows[0];
    }

    /**
     * Enviar campaña inmediatamente
     * Signature: (ctx, id) OR (id, idTenant)
     */
    async sendCampaign(arg1, arg2) {
        let db, tenantId, campaignId, ctx;

        if (arg1 && (arg1.tenantId || arg1.query)) {
            // (ctx, id)
            ctx = arg1;
            db = getTenantDb(arg1);
            tenantId = arg1.tenantId;
            campaignId = arg2;
        } else {
            // (id, idTenant)
            campaignId = arg1;
            tenantId = arg2;
            ctx = { tenantId };
            db = getTenantDb(ctx);
        }

        const existingResult = await db.query('SELECT * FROM email_campaign WHERE id = $1 AND id_tenant = $2', [campaignId, tenantId]);
        const campaign = existingResult.rows[0];

        if (!campaign) throw new Error('Campaña no encontrada');
        if (!['draft', 'scheduled'].includes(campaign.status)) {
            throw new Error('La campaña ya fue enviada o cancelada');
        }

        // Mark as sending
        await db.query(`
            UPDATE email_campaign SET status = 'sending', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [campaignId]);

        try {
            // Get recipients
            const recipients = await this.getRecipients(db, tenantId, campaign.recipient_filter);
            let sentCount = 0;
            let failedCount = 0;

            // Send to each recipient
            for (const recipient of recipients) {
                try {
                    // Render variables
                    const variables = {
                        nombre: recipient.nombre,
                        email: recipient.email,
                        promo_titulo: campaign.promo_titulo || '',
                        promo_descripcion: campaign.preview_text || '',
                        portal_url: 'https://goversa.app/portal'
                    };

                    // Render HTML with variables
                    let html = campaign.html_body;
                    for (const [key, value] of Object.entries(variables)) {
                        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                        html = html.replace(regex, value || '');
                    }

                    let subject = campaign.subject;
                    for (const [key, value] of Object.entries(variables)) {
                        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                        subject = subject.replace(regex, value || '');
                    }

                    // Send via automation service
                    // Call triggerEvent with ctx logic
                    // We updated triggerEvent to accept (ctx, params) or (params)
                    await emailAutomationService.triggerEvent(ctx, {
                        id_tenant: tenantId,
                        event_code: 'CAMPAIGN_' + campaignId,
                        id_cliente: recipient.id,
                        to_email: recipient.email,
                        variables,
                        force_send: true, // Skip automation check
                        custom_subject: subject,
                        custom_html: html
                    });

                    sentCount++;
                } catch (err) {
                    console.error(`Error sending to ${recipient.email}:`, err.message);
                    failedCount++;
                }
            }

            // Update campaign stats
            await db.query(`
                UPDATE email_campaign SET
                    status = 'sent',
                    sent_at = CURRENT_TIMESTAMP,
                    sent_count = $1,
                    failed_count = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [sentCount, failedCount, campaignId]);

            return { sent: sentCount, failed: failedCount };

        } catch (error) {
            // Mark as failed
            await db.query(`
                UPDATE email_campaign SET status = 'draft', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [campaignId]);
            throw error;
        }
    }

    /**
     * Cancelar campaña
     * Signature: (ctx, id) OR (id, idTenant)
     */
    async cancelCampaign(arg1, arg2) {
        let db, tenantId, campaignId;

        if (arg1 && (arg1.tenantId || arg1.query)) {
            // (ctx, id)
            db = getTenantDb(arg1);
            tenantId = arg1.tenantId;
            campaignId = arg2;
        } else {
            // (id, idTenant)
            campaignId = arg1;
            tenantId = arg2;
            db = getTenantDb({ tenantId });
        }

        const existingResult = await db.query('SELECT status FROM email_campaign WHERE id = $1 AND id_tenant = $2', [campaignId, tenantId]);
        const existing = existingResult.rows[0];

        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status === 'sent') throw new Error('No se puede cancelar una campaña ya enviada');

        const result = await db.query(`
            UPDATE email_campaign SET
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND id_tenant = $2
            RETURNING *
        `, [campaignId, tenantId]);

        return result.rows[0];
    }

    /**
     * Obtener destinatarios según filtro
     * Internal method, typically called by this service.
     * Updated to accept db instance or resolve it.
     */
    async getRecipients(ctxOrDb, idTenant, filter) {
        // If ctxOrDb is db, use it. Else resolve.
        // But getRecipients was (idTenant, filter).
        // New signature: (db, idTenant, filter) or (ctx, idTenant, filter)?
        // Or keep (idTenant, filter) and internally resolve? But we don't know tenantId in getRecipients without db/ctx.
        // Wait, idTenant IS passed.
        // But to query, we need db.
        // So signature MUST change if we want to use tenantDb.
        // I'll make it: (ctxOrDb, idTenant, filter).
        // Since it's internal (mostly), I updated callers.

        let db;
        if (ctxOrDb.query) {
            db = ctxOrDb;
        } else {
            db = getTenantDb(ctxOrDb);
        }

        const filterObj = typeof filter === 'string' ? JSON.parse(filter) : filter;
        let query = '';
        let params = [idTenant];

        switch (filterObj.type) {
            case 'all_members':
                query = `
                    SELECT c.id, c.nombre, c.email
                    FROM fidelizacion_miembro m
                    JOIN clientefinal c ON c.id = m.id_cliente
                    WHERE m.id_tenant = $1 AND c.email IS NOT NULL AND c.email != ''
                `;
                break;

            case 'active_members':
                query = `
                    SELECT c.id, c.nombre, c.email
                    FROM fidelizacion_miembro m
                    JOIN clientefinal c ON c.id = m.id_cliente
                    WHERE m.id_tenant = $1 AND m.estado = 'active' AND c.email IS NOT NULL AND c.email != ''
                `;
                break;

            case 'specific':
                if (!filterObj.ids || filterObj.ids.length === 0) return [];
                query = `
                    SELECT c.id, c.nombre, c.email
                    FROM clientefinal c
                    WHERE c.id_tenant = $1 AND c.id = ANY($2) AND c.email IS NOT NULL AND c.email != ''
                `;
                params.push(filterObj.ids);
                break;

            default:
                return [];
        }

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Contar destinatarios según filtro
     * Signature: (ctx, idTenant, filter) OR (db, idTenant, filter)
     */
    async countRecipients(ctxOrDb, idTenant, filter) {
        const recipients = await this.getRecipients(ctxOrDb, idTenant, filter);
        return recipients.length;
    }

    /**
     * Generar preview HTML con datos de ejemplo
     * Signature: (ctx, id) OR (id, idTenant)
     */
    async previewCampaign(arg1, arg2) {
        let db, tenantId, campaignId;

        if (arg1 && (arg1.tenantId || arg1.query)) {
            // (ctx, id)
            db = getTenantDb(arg1);
            tenantId = arg1.tenantId;
            campaignId = arg2;
        } else {
            // (id, idTenant)
            campaignId = arg1;
            tenantId = arg2;
            db = getTenantDb({ tenantId });
        }

        // Use getCampaign logic or query directly
        const result = await db.query(`
            SELECT c.*, p.titulo as promo_titulo
            FROM email_campaign c
            LEFT JOIN fidelizacion_promo p ON p.id = c.id_promo
            WHERE c.id = $1 AND c.id_tenant = $2
        `, [campaignId, tenantId]);
        const campaign = result.rows[0];

        if (!campaign) throw new Error('Campaña no encontrada');

        const variables = {
            nombre: 'Juan Ejemplo',
            email: 'juan@ejemplo.com',
            promo_titulo: campaign.promo_titulo || 'Promoción de Ejemplo',
            promo_descripcion: campaign.preview_text || 'Descripción de la promoción',
            portal_url: 'https://goversa.app/portal'
        };

        let html = campaign.html_body;
        let subject = campaign.subject;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            html = html.replace(regex, value || '');
            subject = subject.replace(regex, value || '');
        }

        return { subject, html };
    }

    /**
     * Eliminar campaña (solo borradores)
     * Signature: (ctx, id) OR (id, idTenant)
     */
    async deleteCampaign(arg1, arg2) {
        let db, tenantId, campaignId;

        if (arg1 && (arg1.tenantId || arg1.query)) {
            // (ctx, id)
            db = getTenantDb(arg1);
            tenantId = arg1.tenantId;
            campaignId = arg2;
        } else {
            // (id, idTenant)
            campaignId = arg1;
            tenantId = arg2;
            db = getTenantDb({ tenantId });
        }

        const existingResult = await db.query('SELECT status FROM email_campaign WHERE id = $1 AND id_tenant = $2', [campaignId, tenantId]);
        const existing = existingResult.rows[0];

        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status !== 'draft' && existing.status !== 'cancelled') {
            throw new Error('Solo se pueden eliminar campañas en borrador o canceladas');
        }

        await db.query('DELETE FROM email_campaign WHERE id = $1 AND id_tenant = $2', [campaignId, tenantId]);
        return true;
    }
}

module.exports = new EmailCampaignService();
