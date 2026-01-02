/**
 * VERSA - Email Campaign Service
 * Gestión de campañas de email programables
 */

const pool = require('../db');
const emailAutomationService = require('./emailAutomationService');

class EmailCampaignService {

    /**
     * Crear una nueva campaña en estado borrador
     */
    async createCampaign(idTenant, data) {
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

        const result = await pool.query(`
            INSERT INTO email_campaign 
            (id_tenant, nombre, tipo, id_promo, template_code, subject, html_body, preview_text, recipient_filter, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [idTenant, nombre, tipo, id_promo, template_code, subject, html_body, preview_text, JSON.stringify(recipient_filter), created_by]);

        // Calculate initial recipient count
        const campaign = result.rows[0];
        const count = await this.countRecipients(idTenant, recipient_filter);
        await pool.query('UPDATE email_campaign SET total_recipients = $1 WHERE id = $2', [count, campaign.id]);
        campaign.total_recipients = count;

        return campaign;
    }

    /**
     * Obtener campaña por ID
     */
    async getCampaign(id, idTenant) {
        const result = await pool.query(`
            SELECT c.*, p.titulo as promo_titulo
            FROM email_campaign c
            LEFT JOIN fidelizacion_promo p ON p.id = c.id_promo
            WHERE c.id = $1 AND c.id_tenant = $2
        `, [id, idTenant]);

        return result.rows[0] || null;
    }

    /**
     * Listar campañas del tenant
     */
    async listCampaigns(idTenant, status = null, limit = 50) {
        let query = `
            SELECT c.*, p.titulo as promo_titulo
            FROM email_campaign c
            LEFT JOIN fidelizacion_promo p ON p.id = c.id_promo
            WHERE c.id_tenant = $1
        `;
        const params = [idTenant];

        if (status) {
            query += ' AND c.status = $2';
            params.push(status);
        }

        query += ' ORDER BY c.created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Actualizar campaña (solo borradores)
     */
    async updateCampaign(id, idTenant, data) {
        const { nombre, subject, html_body, preview_text, recipient_filter } = data;

        // Verify campaign exists and is draft
        const existing = await this.getCampaign(id, idTenant);
        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status !== 'draft') throw new Error('Solo se pueden editar campañas en borrador');

        const result = await pool.query(`
            UPDATE email_campaign SET
                nombre = COALESCE($1, nombre),
                subject = COALESCE($2, subject),
                html_body = COALESCE($3, html_body),
                preview_text = COALESCE($4, preview_text),
                recipient_filter = COALESCE($5, recipient_filter),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND id_tenant = $7
            RETURNING *
        `, [nombre, subject, html_body, preview_text, recipient_filter ? JSON.stringify(recipient_filter) : null, id, idTenant]);

        // Recalculate recipient count if filter changed
        if (recipient_filter) {
            const count = await this.countRecipients(idTenant, recipient_filter);
            await pool.query('UPDATE email_campaign SET total_recipients = $1 WHERE id = $2', [count, id]);
        }

        return result.rows[0];
    }

    /**
     * Programar envío de campaña
     */
    async scheduleCampaign(id, idTenant, scheduledAt) {
        const existing = await this.getCampaign(id, idTenant);
        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status !== 'draft') throw new Error('Solo se pueden programar campañas en borrador');

        const result = await pool.query(`
            UPDATE email_campaign SET
                status = 'scheduled',
                scheduled_at = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND id_tenant = $3
            RETURNING *
        `, [scheduledAt, id, idTenant]);

        return result.rows[0];
    }

    /**
     * Enviar campaña inmediatamente
     */
    async sendCampaign(id, idTenant) {
        const campaign = await this.getCampaign(id, idTenant);
        if (!campaign) throw new Error('Campaña no encontrada');
        if (!['draft', 'scheduled'].includes(campaign.status)) {
            throw new Error('La campaña ya fue enviada o cancelada');
        }

        // Mark as sending
        await pool.query(`
            UPDATE email_campaign SET status = 'sending', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [id]);

        try {
            // Get recipients
            const recipients = await this.getRecipients(idTenant, campaign.recipient_filter);
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
                    await emailAutomationService.triggerEvent({
                        id_tenant: idTenant,
                        event_code: 'CAMPAIGN_' + id,
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
            await pool.query(`
                UPDATE email_campaign SET
                    status = 'sent',
                    sent_at = CURRENT_TIMESTAMP,
                    sent_count = $1,
                    failed_count = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [sentCount, failedCount, id]);

            return { sent: sentCount, failed: failedCount };

        } catch (error) {
            // Mark as failed
            await pool.query(`
                UPDATE email_campaign SET status = 'draft', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [id]);
            throw error;
        }
    }

    /**
     * Cancelar campaña
     */
    async cancelCampaign(id, idTenant) {
        const existing = await this.getCampaign(id, idTenant);
        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status === 'sent') throw new Error('No se puede cancelar una campaña ya enviada');

        const result = await pool.query(`
            UPDATE email_campaign SET
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND id_tenant = $2
            RETURNING *
        `, [id, idTenant]);

        return result.rows[0];
    }

    /**
     * Obtener destinatarios según filtro
     */
    async getRecipients(idTenant, filter) {
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

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Contar destinatarios según filtro
     */
    async countRecipients(idTenant, filter) {
        const recipients = await this.getRecipients(idTenant, filter);
        return recipients.length;
    }

    /**
     * Generar preview HTML con datos de ejemplo
     */
    async previewCampaign(id, idTenant) {
        const campaign = await this.getCampaign(id, idTenant);
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
     */
    async deleteCampaign(id, idTenant) {
        const existing = await this.getCampaign(id, idTenant);
        if (!existing) throw new Error('Campaña no encontrada');
        if (existing.status !== 'draft' && existing.status !== 'cancelled') {
            throw new Error('Solo se pueden eliminar campañas en borrador o canceladas');
        }

        await pool.query('DELETE FROM email_campaign WHERE id = $1 AND id_tenant = $2', [id, idTenant]);
        return true;
    }
}

module.exports = new EmailCampaignService();
