/**
 * VERSA - BLOQUE 7: Email Automations
 * Servicio de automatización de emails
 * 
 * Maneja la lógica de disparar eventos, resolver plantillas,
 * renderizar variables y enviar emails
 */

const pool = require('../db');
const makeEmailProvider = require('./makeEmailProvider');

const APP_PUBLIC_BASE_URL = process.env.APP_PUBLIC_BASE_URL || 'http://localhost:5173';

class EmailAutomationService {

    /**
     * Disparar un evento de email
     * 
     * @param {Object} params
     * @param {number} params.id_tenant - ID del tenant
     * @param {string} params.event_code - Código del evento (CLIENT_REGISTERED, PASSWORD_RESET_REQUESTED)
     * @param {number} [params.id_cliente] - ID del cliente (opcional)
     * @param {string} params.to_email - Email destino
     * @param {Object} params.variables - Variables para la plantilla
     * @returns {Promise<{ok: boolean, event_log_id?: number, error?: string}>}
     */
    async triggerEvent({ id_tenant, event_code, id_cliente, to_email, variables = {} }) {
        const client = await pool.connect();

        try {
            // 1. Buscar automatización habilitada para este evento
            const automationResult = await client.query(`
                SELECT * FROM email_automation 
                WHERE id_tenant = $1 AND event_code = $2 AND enabled = true
            `, [id_tenant, event_code]);

            if (automationResult.rows.length === 0) {
                console.log(`[EmailAutomation] No hay automatización activa para ${event_code} en tenant ${id_tenant}`);
                return { ok: true, skipped: true, reason: 'No automation configured' };
            }

            const automation = automationResult.rows[0];

            // 2. Resolver plantilla (primero tenant, luego global)
            const template = await this.resolveTemplate(client, id_tenant, automation.template_code);

            if (!template) {
                console.error(`[EmailAutomation] Plantilla ${automation.template_code} no encontrada`);
                return { ok: false, error: 'Template not found' };
            }

            // 3. Renderizar subject y html con variables
            const renderedSubject = this.renderTemplate(template.subject, variables);
            const renderedHtml = this.renderTemplate(template.html_body, variables);
            const renderedText = template.text_body
                ? this.renderTemplate(template.text_body, variables)
                : null;

            // 4. Generar clave de idempotencia
            const idempotencyKey = this.generateIdempotencyKey(event_code, id_cliente, variables);

            // 5. Verificar idempotencia
            const existingLog = await client.query(`
                SELECT id, status FROM email_event_log 
                WHERE idempotency_key = $1
            `, [idempotencyKey]);

            if (existingLog.rows.length > 0) {
                console.log(`[EmailAutomation] Email ya enviado (idempotency: ${idempotencyKey})`);
                return {
                    ok: true,
                    skipped: true,
                    reason: 'Already sent',
                    event_log_id: existingLog.rows[0].id
                };
            }

            // 6. Crear registro en email_event_log
            const logResult = await client.query(`
                INSERT INTO email_event_log (
                    id_tenant, event_code, id_cliente, to_email, 
                    subject_snapshot, html_snapshot, status, idempotency_key,
                    metadata_json
                ) VALUES ($1, $2, $3, $4, $5, $6, 'QUEUED', $7, $8)
                RETURNING id
            `, [
                id_tenant,
                event_code,
                id_cliente,
                to_email,
                renderedSubject,
                renderedHtml,
                idempotencyKey,
                JSON.stringify({ variables, template_code: automation.template_code })
            ]);

            const eventLogId = logResult.rows[0].id;

            // 7. Enviar email inmediatamente (sin delay por ahora)
            const sendResult = await makeEmailProvider.sendEmail({
                to: to_email,
                subject: renderedSubject,
                html: renderedHtml,
                text: renderedText,
                meta: {
                    type: event_code,
                    id_tenant,
                    id_cliente,
                    event_id: eventLogId
                }
            });

            // 8. Actualizar estado
            if (sendResult.ok) {
                await client.query(`
                    UPDATE email_event_log 
                    SET status = 'SENT', 
                        sent_at = NOW(), 
                        provider_message_id = $1
                    WHERE id = $2
                `, [sendResult.messageId, eventLogId]);

                console.log(`[EmailAutomation] ✅ Email ${event_code} enviado a ${to_email}`);
            } else {
                await client.query(`
                    UPDATE email_event_log 
                    SET status = 'FAILED', 
                        error_message = $1
                    WHERE id = $2
                `, [sendResult.error, eventLogId]);

                console.error(`[EmailAutomation] ❌ Error enviando ${event_code} a ${to_email}:`, sendResult.error);
            }

            return {
                ok: sendResult.ok,
                event_log_id: eventLogId,
                error: sendResult.error
            };

        } catch (error) {
            console.error('[EmailAutomation] Error en triggerEvent:', error);
            return { ok: false, error: error.message };
        } finally {
            client.release();
        }
    }

    /**
     * Resolver plantilla por tenant con fallback a global
     */
    async resolveTemplate(client, id_tenant, template_code) {
        // Primero buscar específica del tenant
        let result = await client.query(`
            SELECT * FROM email_template 
            WHERE id_tenant = $1 AND code = $2 AND is_active = true
        `, [id_tenant, template_code]);

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Fallback a global
        result = await client.query(`
            SELECT * FROM email_template 
            WHERE id_tenant IS NULL AND code = $1 AND is_active = true
        `, [template_code]);

        return result.rows[0] || null;
    }

    /**
     * Renderizar plantilla reemplazando variables {{variable}}
     */
    renderTemplate(template, variables) {
        if (!template) return template;

        let rendered = template;

        // Reemplazar cada variable
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            rendered = rendered.replace(regex, value || '');
        }

        // Limpiar variables no reemplazadas
        rendered = rendered.replace(/\{\{\s*\w+\s*\}\}/g, '');

        return rendered;
    }

    /**
     * Generar clave de idempotencia
     */
    generateIdempotencyKey(event_code, id_cliente, variables) {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

        switch (event_code) {
            case 'CLIENT_REGISTERED':
                // Un welcome por cliente por día
                return `WELCOME:${id_cliente}:${today}`;

            case 'PASSWORD_RESET_REQUESTED':
                // Un reset por token
                if (variables.reset_token) {
                    return `RESET:${id_cliente}:${variables.reset_token}`;
                }
                return `RESET:${id_cliente}:${today}:${Date.now()}`;

            default:
                return `${event_code}:${id_cliente}:${today}:${Date.now()}`;
        }
    }

    // =====================================================
    // MÉTODOS DE ADMINISTRACIÓN
    // =====================================================

    /**
     * Obtener plantillas por tenant
     */
    async getTemplates(id_tenant, code = null) {
        let query = `
            SELECT * FROM email_template 
            WHERE (id_tenant = $1 OR id_tenant IS NULL)
        `;
        const params = [id_tenant];

        if (code) {
            query += ` AND code = $2`;
            params.push(code);
        }

        query += ` ORDER BY id_tenant NULLS LAST, code`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Upsert plantilla por tenant
     */
    async upsertTemplate(id_tenant, code, data) {
        const result = await pool.query(`
            INSERT INTO email_template (id_tenant, code, name, subject, html_body, text_body, variables_json, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id_tenant, code) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                subject = EXCLUDED.subject,
                html_body = EXCLUDED.html_body,
                text_body = EXCLUDED.text_body,
                variables_json = EXCLUDED.variables_json,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            RETURNING *
        `, [
            id_tenant,
            code,
            data.name || code,
            data.subject,
            data.html_body,
            data.text_body || null,
            data.variables_json ? JSON.stringify(data.variables_json) : null,
            data.is_active !== false
        ]);

        return result.rows[0];
    }

    /**
     * Obtener automatizaciones por tenant
     */
    async getAutomations(id_tenant) {
        const result = await pool.query(`
            SELECT ea.*, et.name as template_name
            FROM email_automation ea
            LEFT JOIN email_template et ON et.code = ea.template_code 
                AND (et.id_tenant = ea.id_tenant OR et.id_tenant IS NULL)
            WHERE ea.id_tenant = $1
            ORDER BY ea.event_code
        `, [id_tenant]);

        return result.rows;
    }

    /**
     * Actualizar automatización
     */
    async updateAutomation(id_tenant, event_code, data) {
        const result = await pool.query(`
            UPDATE email_automation
            SET 
                enabled = COALESCE($3, enabled),
                template_code = COALESCE($4, template_code),
                delay_seconds = COALESCE($5, delay_seconds),
                updated_at = NOW()
            WHERE id_tenant = $1 AND event_code = $2
            RETURNING *
        `, [
            id_tenant,
            event_code,
            data.enabled,
            data.template_code,
            data.delay_seconds
        ]);

        return result.rows[0];
    }

    /**
     * Obtener logs de emails
     */
    async getLogs(id_tenant, limit = 50) {
        const result = await pool.query(`
            SELECT id, event_code, to_email, subject_snapshot, status, 
                   error_message, created_at, sent_at
            FROM email_event_log
            WHERE id_tenant = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [id_tenant, limit]);

        return result.rows;
    }

    // =====================================================
    // TEMPLATE CRUD
    // =====================================================

    /**
     * Crear nueva plantilla
     */
    async createTemplate(id_tenant, data) {
        const result = await pool.query(`
            INSERT INTO email_template (
                id_tenant, code, name, subject, html_body, text_body, 
                variables_json, is_active, is_system, category, description, preview_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)
            RETURNING *
        `, [
            id_tenant,
            data.code,
            data.name,
            data.subject,
            data.html_body,
            data.text_body || '',
            data.variables_json || '[]',
            data.is_system || false,
            data.category || 'marketing',
            data.description || '',
            data.preview_text || ''
        ]);

        return result.rows[0];
    }

    /**
     * Eliminar plantilla (solo no-system)
     */
    async deleteTemplate(id_tenant, code) {
        const result = await pool.query(`
            DELETE FROM email_template 
            WHERE id_tenant = $1 AND code = $2 AND (is_system = false OR is_system IS NULL)
            RETURNING id
        `, [id_tenant, code]);

        return result.rowCount > 0;
    }

    // =====================================================
    // AUTOMATION CRUD
    // =====================================================

    /**
     * Crear nueva automatización
     */
    async createAutomation(id_tenant, data) {
        const result = await pool.query(`
            INSERT INTO email_automation (
                id_tenant, event_code, template_code, enabled, delay_seconds, trigger_type
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            id_tenant,
            data.event_code,
            data.template_code,
            data.enabled !== false,
            data.delay_seconds || 0,
            data.trigger_type || 'event'
        ]);

        return result.rows[0];
    }

    /**
     * Eliminar automatización
     */
    async deleteAutomation(id_tenant, event_code) {
        const result = await pool.query(`
            DELETE FROM email_automation 
            WHERE id_tenant = $1 AND event_code = $2
            RETURNING id
        `, [id_tenant, event_code]);

        return result.rowCount > 0;
    }

    // =====================================================
    // CONFIG MANAGEMENT
    // =====================================================

    /**
     * Obtener configuración de email del tenant
     */
    async getConfig(id_tenant) {
        const result = await pool.query(`
            SELECT * FROM email_config WHERE id_tenant = $1
        `, [id_tenant]);

        return result.rows[0] || null;
    }

    /**
     * Crear o actualizar configuración de email
     */
    async upsertConfig(id_tenant, data) {
        const result = await pool.query(`
            INSERT INTO email_config (id_tenant, webhook_url, sender_name, sender_email, enabled)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id_tenant) 
            DO UPDATE SET 
                webhook_url = EXCLUDED.webhook_url,
                sender_name = EXCLUDED.sender_name,
                sender_email = EXCLUDED.sender_email,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            RETURNING *
        `, [
            id_tenant,
            data.webhook_url,
            data.sender_name || 'VERSA',
            data.sender_email || 'noreply@versa.app',
            data.enabled !== false
        ]);

        return result.rows[0];
    }

    /**
     * Actualizar estado del último test
     */
    async updateConfigTestStatus(id_tenant, success, error = null) {
        await pool.query(`
            UPDATE email_config 
            SET last_test_at = NOW(),
                last_test_status = $2,
                last_test_error = $3
            WHERE id_tenant = $1
        `, [id_tenant, success ? 'SUCCESS' : 'FAILED', error]);
    }
}

module.exports = new EmailAutomationService();

