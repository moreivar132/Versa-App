/**
 * VERSA - BLOQUE 7: Email Automations
 * Provider de email usando Make.com Webhook
 * 
 * Este provider envía emails a través de un webhook de Make.com
 * que se encarga del envío real vía SMTP/SendGrid/etc
 * 
 * La URL del webhook se lee de:
 * 1. meta.webhook_url (pasado explícitamente para tests)
 * 2. Base de datos (email_config por tenant)
 * 3. process.env.MAKE_EMAIL_WEBHOOK_URL (fallback)
 */

const { getTenantDb } = require('../src/core/db/tenant-db');

// Fallback desde .env
const ENV_WEBHOOK_URL = process.env.MAKE_EMAIL_WEBHOOK_URL;

/**
 * Obtener webhook URL para un tenant
 * Primero busca en DB, si no hay usa .env
 */
async function getWebhookUrl(id_tenant) {
    try {
        if (!id_tenant) return null;
        const db = getTenantDb({ tenantId: id_tenant });
        const result = await db.query(
            'SELECT webhook_url, sender_name, sender_email FROM email_config WHERE id_tenant = $1 AND enabled = true',
            [id_tenant]
        );

        if (result.rows.length > 0 && result.rows[0].webhook_url) {
            return {
                url: result.rows[0].webhook_url,
                sender_name: result.rows[0].sender_name || 'VERSA',
                sender_email: result.rows[0].sender_email || 'noreply@versa.app'
            };
        }
    } catch (e) {
        console.warn('[MakeEmailProvider] Error leyendo config de DB:', e.message);
    }

    // Fallback a .env
    if (ENV_WEBHOOK_URL) {
        return {
            url: ENV_WEBHOOK_URL,
            sender_name: 'VERSA',
            sender_email: 'noreply@versa.app'
        };
    }

    return null;
}

/**
 * Enviar email a través del webhook de Make
 * 
 * @param {Object} params
 * @param {string} params.to - Email destino
 * @param {string} params.subject - Asunto del email
 * @param {string} params.html - Contenido HTML
 * @param {string} [params.text] - Contenido texto plano (opcional)
 * @param {Object} [params.meta] - Metadata adicional
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html, text, meta = {} }) {
    const id_tenant = meta.id_tenant || 1;

    // Obtener webhook URL (de meta, DB, o .env)
    let webhookConfig;
    if (meta.webhook_url) {
        // URL pasada explícitamente (para tests)
        webhookConfig = {
            url: meta.webhook_url,
            sender_name: meta.sender_name || 'VERSA',
            sender_email: meta.sender_email || 'noreply@versa.app'
        };
    } else {
        webhookConfig = await getWebhookUrl(id_tenant);
    }

    if (!webhookConfig || !webhookConfig.url) {
        console.warn('[MakeEmailProvider] Webhook URL no configurado. Email no enviado.');
        return {
            ok: false,
            error: 'Webhook URL no configurado. Configúralo en Marketing → Email → Configuración.'
        };
    }

    const payload = {
        id_tenant,
        to,
        from_name: webhookConfig.sender_name,
        from_email: webhookConfig.sender_email,
        subject,
        html,
        text: text || '',
        meta: {
            type: meta.type || 'UNKNOWN',
            id_cliente: meta.id_cliente || null,
            event_id: meta.event_id || null,
            timestamp: new Date().toISOString(),
            ...meta
        }
    };

    try {
        console.log(`[MakeEmailProvider] Enviando email a ${to} (${meta.type || 'UNKNOWN'}) via ${webhookConfig.url.substring(0, 40)}...`);

        const response = await fetch(webhookConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[MakeEmailProvider] Error HTTP ${response.status}:`, errorText);
            return {
                ok: false,
                error: `HTTP ${response.status}: ${errorText}`
            };
        }

        // Make.com puede devolver un ID o simplemente éxito
        let responseData = {};
        try {
            const responseText = await response.text();
            responseData = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            // Respuesta no-JSON está bien para Make
        }

        console.log(`[MakeEmailProvider] ✅ Email enviado a ${to}`);

        return {
            ok: true,
            messageId: responseData.messageId || responseData.id || `make-${Date.now()}`
        };

    } catch (error) {
        console.error('[MakeEmailProvider] Error enviando email:', error);
        return {
            ok: false,
            error: error.message
        };
    }
}

module.exports = {
    sendEmail,
    getWebhookUrl
};
