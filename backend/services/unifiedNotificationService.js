/**
 * VERSA - Unified Notification Service
 * 
 * Central hub for all outgoing notifications (email + dashboard).
 * Uses notificationEvents.js as the event registry.
 * 
 * Usage:
 * const unifiedNotificationService = require('./unifiedNotificationService');
 * await unifiedNotificationService.notify({
 *     idTenant: 1,
 *     idCliente: 123,
 *     eventCode: 'LOYALTY_POINTS_EARNED',
 *     channels: ['email', 'dashboard'], // optional, defaults from event config
 *     data: { puntos_ganados: 50, motivo: 'Alquiler' }
 * });
 */

const { getTenantDb, getSystemDb } = require('../src/core/db/tenant-db');
const emailAutomationService = require('./emailAutomationService');
const notificacionService = require('./notificacionService');

class UnifiedNotificationService {

    /**
     * Send a notification through specified channels
     */
    async notify({ idTenant, idCliente, eventCode, channels, data = {}, toEmail = null }) {
        const event = getEvent(eventCode);

        if (!event) {
            console.error(`[UnifiedNotification] Unknown event code: ${eventCode}`);
            return { ok: false, error: 'Unknown event code' };
        }

        // Default channels from event config
        const activeChannels = channels || event.channels || ['dashboard'];
        const results = { email: null, dashboard: null };

        try {
            // Get client data if not provided
            let clientData = data;
            if (idCliente && !data.nombre) {
                // Determine DB context (requires tenantId)
                if (!idTenant) {
                    throw new Error('TenantID required for notification client lookup');
                }
                const db = getTenantDb({ tenantId: idTenant });

                const clientResult = await db.query(
                    'SELECT nombre, email FROM clientefinal WHERE id = $1 AND id_tenant = $2',
                    [idCliente, idTenant]
                );
                if (clientResult.rows.length > 0) {
                    clientData = {
                        ...data,
                        nombre: clientResult.rows[0].nombre,
                        email: clientResult.rows[0].email
                    };
                    toEmail = toEmail || clientResult.rows[0].email;
                }
            }

            // Ensure template and automation exist
            await this.ensureTemplateExists(idTenant, eventCode, event);
            await this.ensureAutomationExists(idTenant, eventCode);

            // Send to each channel
            if (activeChannels.includes('email') && toEmail) {
                results.email = await this.sendEmail(idTenant, idCliente, eventCode, toEmail, clientData);
            }

            if (activeChannels.includes('dashboard') && idCliente) {
                results.dashboard = await this.sendDashboardNotification(idCliente, eventCode, event, clientData);
            }

            return { ok: true, results };

        } catch (error) {
            console.error(`[UnifiedNotification] Error sending ${eventCode}:`, error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Send email via emailAutomationService
     */
    async sendEmail(idTenant, idCliente, eventCode, toEmail, data) {
        try {
            const result = await emailAutomationService.triggerEvent({
                id_tenant: idTenant,
                event_code: eventCode,
                id_cliente: idCliente,
                to_email: toEmail,
                variables: data
            });
            return result;
        } catch (error) {
            console.error(`[UnifiedNotification] Email error:`, error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Send dashboard notification via notificacionService
     */
    async sendDashboardNotification(idCliente, eventCode, event, data) {
        try {
            // Render title and message with variables
            let title = event.name;
            let message = data.mensaje || '';

            // Simple variable replacement in title if needed
            if (event.subject) {
                title = this.renderTemplate(event.subject, data);
            }

            await notificacionService.crearNotificacion(
                idCliente,
                eventCode.toLowerCase(),
                title,
                message,
                data
            );
            return { ok: true };
        } catch (error) {
            console.error(`[UnifiedNotification] Dashboard error:`, error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Ensure email template exists in database
     */
    async ensureTemplateExists(idTenant, eventCode, event) {
        if (!event.htmlTemplate && !event.subject) return;

        try {
            // System templates go to system DB (id_tenant IS NULL)
            const systemDb = getSystemDb();
            await systemDb.query(`
                INSERT INTO email_template (id_tenant, code, name, subject, html_body, variables_json)
                VALUES (NULL, $1, $2, $3, $4, $5)
                ON CONFLICT (id_tenant, code) DO NOTHING
            `, [
                eventCode,
                event.name,
                event.subject,
                event.htmlTemplate || this.generateDefaultTemplate(event),
                JSON.stringify(event.variables || [])
            ]);
        } catch (error) {
            // Ignore if already exists
            console.log(`[UnifiedNotification] Template check for ${eventCode}`);
        }
    }

    /**
     * Ensure automation exists for this tenant
     */
    async ensureAutomationExists(idTenant, eventCode) {
        try {
            if (!idTenant) return;
            const db = getTenantDb({ tenantId: idTenant });
            await db.query(`
                INSERT INTO email_automation (id_tenant, event_code, template_code, enabled)
                VALUES ($1, $2, $2, true)
                ON CONFLICT (id_tenant, event_code) DO NOTHING
            `, [idTenant, eventCode]);
        } catch (error) {
            // Ignore if already exists
        }
    }

    /**
     * Generate a default HTML template from event config
     */
    generateDefaultTemplate(event) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111318; color: white; padding: 20px; border-radius: 16px;">
                <h2 style="color: #ff5f00;">{{nombre}}</h2>
                <p>${event.description || 'Tienes una nueva notificación.'}</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://goversa.app/portal" style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver en Portal</a>
                </div>
            </div>`;
    }

    /**
     * Simple template variable replacement
     */
    renderTemplate(template, variables) {
        if (!template) return template;
        let rendered = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            rendered = rendered.replace(regex, value || '');
        }
        return rendered;
    }

    /**
     * Bulk notify multiple clients (e.g., for promos)
     */
    async notifyBulk({ idTenant, clientIds, eventCode, data = {} }) {
        const results = [];
        for (const idCliente of clientIds) {
            const result = await this.notify({ idTenant, idCliente, eventCode, data });
            results.push({ idCliente, ...result });
        }
        return results;
    }
}

module.exports = new UnifiedNotificationService();
