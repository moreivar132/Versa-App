/**
 * VERSA - BLOQUE 7: Email Automations
 * Servicio de automatización de emails
 * 
 * Maneja la lógica de disparar eventos, resolver plantillas,
 * renderizar variables y enviar emails
 */

// const pool = require('../db'); // REMOVED
const { getTenantDb } = require('../src/core/db/tenant-db');
const makeEmailProvider = require('./makeEmailProvider');
const { APP_URL } = require('../config/urls');

class EmailAutomationService {

    /**
     * Helper to resolve DB context for dual-mode support
     */
    _resolveDb(ctxOrId) {
        if (ctxOrId && (ctxOrId.tenantId || ctxOrId.query)) {
            // It's a context or a DB instance
            return getTenantDb(ctxOrId);
        }
        // It's a tenant ID (legacy)
        return getTenantDb({ tenantId: ctxOrId });
    }

    /**
     * Disparar un evento de email
     * 
     * @param {Object|Context} ctxOrParams - Context or Params object (legacy)
     * @param {Object} [params] - Params if ctx is first arg
     */
    async triggerEvent(ctxOrParams, params = null) {
        let ctx, data;
        // Detect signature: (ctx, params) vs ({ id_tenant, ... })
        if (ctxOrParams && ctxOrParams.tenantId) {
            ctx = ctxOrParams;
            data = params;
        } else {
            // Legacy: params object as first arg
            data = ctxOrParams;
            ctx = { tenantId: data.id_tenant };
        }

        const { id_tenant, event_code, id_cliente, to_email, variables = {}, force_send } = data;
        const db = getTenantDb(ctx);

        try {
            // 1. Buscar automatización habilitada para este evento
            // Unless force_send is true (used by manual campaign send)
            let automation = null;

            if (!force_send) {
                const automationResult = await db.query(`
                    SELECT * FROM email_automation 
                    WHERE id_tenant = $1 AND event_code = $2 AND enabled = true
                `, [id_tenant, event_code]);

                if (automationResult.rows.length === 0) {
                    console.log(`[EmailAutomation] No hay automatización activa para ${event_code} en tenant ${id_tenant}`);
                    return { ok: true, skipped: true, reason: 'No automation configured' };
                }
                automation = automationResult.rows[0];
            }

            // 2. Resolver plantilla
            let templateCode = automation ? automation.template_code : null;
            if (data.template_code) templateCode = data.template_code; // Override if provided (unlikely in pure automation, but possible)

            // For campaigns (manual send), template checks might be skipped or handled differently
            // But if we are here via triggerEvent, we usually want to resolve variables using the service logic

            // If manual send with custom subject/html, we might skip template resolution
            let template = null;
            if (data.custom_html && data.custom_subject) {
                template = {
                    subject: data.custom_subject,
                    html_body: data.custom_html,
                    text_body: null
                };
            } else if (templateCode) {
                template = await this.resolveTemplate(db, id_tenant, templateCode);
            }

            if (!template) {
                console.error(`[EmailAutomation] Plantilla no encontrada o no especificada`);
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
            const existingLog = await db.query(`
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
            const logResult = await db.query(`
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
                JSON.stringify({ variables, template_code: templateCode })
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
                await db.query(`
                    UPDATE email_event_log 
                    SET status = 'SENT', 
                        sent_at = NOW(), 
                        provider_message_id = $1
                    WHERE id = $2
                `, [sendResult.messageId, eventLogId]);

                console.log(`[EmailAutomation] ✅ Email ${event_code} enviado a ${to_email}`);
            } else {
                await db.query(`
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
        }
    }

    /**
     * Resolver plantilla por tenant con fallback a global
     */
    async resolveTemplate(db, id_tenant, template_code) {
        // Primero buscar específica del tenant
        let result = await db.query(`
            SELECT * FROM email_template 
            WHERE id_tenant = $1 AND code = $2 AND is_active = true
        `, [id_tenant, template_code]);

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Fallback a global
        // Note: Global templates might have id_tenant NULL. 
        // Strict tenant DB might enforce WHERE id_tenant = X.
        // We might need to use allowNoTenant or queryRaw if the wrapper prohibits it.
        // But typically getTenantDb(ctx) enforces id_tenant = ctx.tenantId.
        // Cross-tenant access (id_tenant IS NULL) might require bypass if RLS blocks it.
        // Assuming public templates are visible or we have read access.
        // For now, using db.query with explicit SQL.

        // If checking for NULL id_tenant (global), we need to ensure the wrapper allows it.
        // Usually, `WHERE (id_tenant = $1 OR id_tenant IS NULL)` is safe IF RLS allows it.
        // If RLS is strictly `id_tenant = current_setting`, then `IS NULL` rows are invisible unless policy allows.
        // We will assume for now it works or policies will be updated to allow reading global templates.

        result = await db.query(`
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

            case 'LOYALTY_POINTS_EARNED':
                // Permitir varios al día (por ejemplo uno cada hora o por timestamp para evitar duplicados accidentales pero permitir flujo normal)
                return `LOYALTY:${id_cliente}:${Date.now()}`;

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
    async getTemplates(ctxOrId, code = null) {
        const db = this._resolveDb(ctxOrId);
        const tenantId = db.tenantId; // Derived from context

        let query = `
            SELECT * FROM email_template 
            WHERE (id_tenant = $1 OR id_tenant IS NULL)
        `;
        const params = [tenantId];

        if (code) {
            query += ` AND code = $2`;
            params.push(code);
        }

        query += ` ORDER BY id_tenant NULLS LAST, code`;

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Upsert plantilla por tenant
     */
    async upsertTemplate(ctxOrId, code, data) {
        const db = this._resolveDb(ctxOrId);
        const tenantId = db.tenantId;

        const result = await db.query(`
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
            tenantId,
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
    async getAutomations(ctxOrId) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            SELECT ea.*, et.name as template_name
            FROM email_automation ea
            LEFT JOIN email_template et ON et.code = ea.template_code 
                AND (et.id_tenant = ea.id_tenant OR et.id_tenant IS NULL)
            WHERE ea.id_tenant = $1
            ORDER BY ea.event_code
        `, [db.tenantId]);

        return result.rows;
    }

    /**
     * Actualizar automatización
     */
    async updateAutomation(ctxOrId, event_code, data) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            UPDATE email_automation
            SET 
                enabled = COALESCE($3, enabled),
                template_code = COALESCE($4, template_code),
                delay_seconds = COALESCE($5, delay_seconds),
                updated_at = NOW()
            WHERE id_tenant = $1 AND event_code = $2
            RETURNING *
        `, [
            db.tenantId,
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
    async getLogs(ctxOrId, limit = 50) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            SELECT id, event_code, to_email, subject_snapshot, status, 
                   error_message, created_at, sent_at
            FROM email_event_log
            WHERE id_tenant = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [db.tenantId, limit]);

        return result.rows;
    }

    // =====================================================
    // TEMPLATE CRUD
    // =====================================================

    /**
     * Crear nueva plantilla
     */
    async createTemplate(ctxOrId, data) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            INSERT INTO email_template (
                id_tenant, code, name, subject, html_body, text_body, 
                variables_json, is_active, is_system, category, description, preview_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)
            RETURNING *
        `, [
            db.tenantId,
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
    async deleteTemplate(ctxOrId, code) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            DELETE FROM email_template 
            WHERE id_tenant = $1 AND code = $2 AND (is_system = false OR is_system IS NULL)
            RETURNING id
        `, [db.tenantId, code]);

        return result.rowCount > 0;
    }

    // =====================================================
    // AUTOMATION CRUD
    // =====================================================

    /**
     * Crear nueva automatización
     */
    async createAutomation(ctxOrId, data) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            INSERT INTO email_automation (
                id_tenant, event_code, template_code, enabled, delay_seconds, trigger_type
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            db.tenantId,
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
    async deleteAutomation(ctxOrId, event_code) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            DELETE FROM email_automation 
            WHERE id_tenant = $1 AND event_code = $2
            RETURNING id
        `, [db.tenantId, event_code]);

        return result.rowCount > 0;
    }

    // =====================================================
    // CONFIG MANAGEMENT
    // =====================================================

    /**
     * Obtener configuración de email del tenant
     */
    async getConfig(ctxOrId) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
            SELECT * FROM email_config WHERE id_tenant = $1
        `, [db.tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Crear o actualizar configuración de email
     */
    async upsertConfig(ctxOrId, data) {
        const db = this._resolveDb(ctxOrId);

        const result = await db.query(`
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
            db.tenantId,
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
    async updateConfigTestStatus(ctxOrId, success, error = null) {
        const db = this._resolveDb(ctxOrId);

        await db.query(`
            UPDATE email_config 
            SET last_test_at = NOW(),
                last_test_status = $2,
                last_test_error = $3
            WHERE id_tenant = $1
        `, [db.tenantId, success ? 'SUCCESS' : 'FAILED', error]);
    }

    async sendPointsEarnedEmail(ctxOrId, email, nombre, puntosGanados, balanceTotal, motivo) {
        // Legacy support: if first arg is idTenant (integer/string)
        // We use triggerEvent internally or just sendEmail?
        // Original code used makeEmailProvider directly. 
        // We should just use makeEmailProvider but we need context if we want to log it?
        // Original code didn't log it in DB via triggerEvent, but sent directly.
        // Keeping it simple.

        if (!email) return false;

        const tenantId = (typeof ctxOrId === 'object' && ctxOrId.tenantId) ? ctxOrId.tenantId : ctxOrId;

        const subject = `¡Has ganado ${puntosGanados} puntos en VERSA!`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ff5f00;">¡Felicidades, ${nombre}!</h2>
                <p>Acabas de sumar puntos en tu tarjeta de fidelización.</p>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="font-size: 24px; font-weight: bold; margin: 0;">+${puntosGanados} Puntos</p>
                    <p style="color: #666; margin: 5px 0 0 0;">Motivo: ${motivo}</p>
                </div>

                <p>Tu saldo actual es de: <strong>${balanceTotal} puntos</strong></p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://goversa.app/portal" style="background-color: #ff5f00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Ver mi Tarjeta</a>
                </div>
            </div>
        `;

        return makeEmailProvider.sendEmail({
            to: email,
            subject,
            html,
            meta: {
                type: 'POINTS_EARNED',
                id_tenant: tenantId
            }
        });
    }
}

module.exports = new EmailAutomationService();

