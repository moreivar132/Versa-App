/**
 * TimelinesAI Webhooks Controller
 */

const crypto = require('crypto');
const { getSystemDb } = require('../../../../../core/db/tenant-db');
const emailService = require('../../application/services/emailService');

/**
 * TimelinesAI Webhooks Controller
 * Handles message:received:new to create/update leads.
 */
async function timelinesWebhook(req, res) {
    // 1. Validar Token
    const providedToken = String(req.query.token || "");
    const secretToken = process.env.TIMELINES_WEBHOOK_SECRET;

    if (!secretToken || providedToken !== secretToken) {
        console.warn(`[Webhook Unauthorized] IP: ${req.ip}`);
        return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // Respuesta optimista inmediata para TimelinesAI
    // TimelinesAI reintentará si NO respondemos 200, así que respondemos al final,
    // pero envolvemos en try/catch seguro que siempre devuelva 200.

    const db = getSystemDb({ source: 'timelines_webhook', reason: 'incoming_message' });

    try {
        const body = req.body || {};
        const eventType = body.event || 'unknown';

        // Metadata para logs
        const metadata = {
            ip: req.ip,
            eventType,
            chat_id: body.chat_id,
            timestamp: new Date().toISOString()
        };

        // Solo procesamos 'message:received:new'
        if (eventType !== 'message:received:new') {
            console.log('[Webhook Skipped] Ignored event type:', eventType);
            return res.status(200).json({ ok: true, ignored: true });
        }

        // 2. Parseo Defensivo del Mensaje
        const messageData = body.message || {};
        const chatData = body.chat || {}; // A veces viene info del chat

        const externalChatId = String(body.chat_id || messageData.chat_id || "");
        const messageText = String(messageData.text || body.text || "");
        const senderName = messageData.sender?.full_name || chatData.full_name || "Desconocido";
        const senderPhone = messageData.sender?.phone || chatData.phone || "";
        const timestamp = messageData.timestamp ? new Date(messageData.timestamp) : new Date();
        const messageId = String(messageData.message_id || body.message_id || "");

        if (!externalChatId) {
            console.warn('[Webhook Warning] No chat_id found in payload');
            return res.status(200).json({ ok: true, error: "no_data" });
        }

        // 3. Deduplicación
        // Generamos un ID único si no viene message_id
        const eventUniqueId = messageId || crypto.createHash('md5').update(`${externalChatId}-${messageText}-${timestamp.getTime()}`).digest('hex');

        // Verificamos si ya lo procesamos
        // Usamos try/catch para verificar existencia de tabla por si la migración falló
        try {
            const existingEvent = await db.queryRaw(
                'SELECT id FROM tasksleads_webhook_event WHERE external_event_id = $1',
                [eventUniqueId]
            );

            if (existingEvent.rows.length > 0) {
                console.log('[Webhook Skipped] Duplicate event:', eventUniqueId);
                return res.status(200).json({ ok: true, duplicated: true });
            }

            // Registramos el evento (Commit posterior o inmediato)
            // Lo hacemos al final o aquí? Mejor aquí para asegurar idempotencia futura rapida
            await db.queryRaw(
                `INSERT INTO tasksleads_webhook_event 
                (external_event_id, event_type, payload, created_at) 
                VALUES ($1, $2, $3, NOW())`,
                [eventUniqueId, eventType, JSON.stringify(body)]
            );
        } catch (err) {
            console.warn('[Webhook DB Warning] Could not check deduplication (table missing?):', err.message);
            // Continuamos igual, es mejor procesar doble que perder leads en Beta
        }

        // 4. Filtro de Grupos
        const isGroup = body.is_group ||
            externalChatId.includes('@g.us') ||
            (chatData.products_count === undefined && chatData.participants_count > 1); // Heurística

        if (isGroup) {
            console.log('[Webhook Skipped] Group message');
            return res.status(200).json({ ok: true, ignored: 'group' });
        }

        // 5. Lógica de Lead (Buscar o Crear)
        // Buscamos si existe link con este chat externo
        const linkResult = await db.queryRaw(
            `SELECT lead_id, id_tenant FROM tasksleads_lead_timeline_link WHERE timeline_external_id = $1 LIMIT 1`,
            [externalChatId]
        );

        let leadId = null;
        let tenantId = 1; // FALLBACK DEFAULT TENANT (Cambiar si hay lógica multi-tenant real)

        if (linkResult.rows.length > 0) {
            // LEAD EXISTE: UPDATE
            leadId = linkResult.rows[0].lead_id;
            tenantId = linkResult.rows[0].id_tenant;

            console.log(`[Webhook] Updating existing lead ${leadId}`);

            // Actualizamos actividad y preview
            // Usamos queryRaw para evitar problemas de RLS si el contexto no está set (SystemDb lo bypasea pero igual)
            await db.queryRaw(
                `UPDATE tasksleads_lead 
                 SET last_activity_at = $1, last_message_preview = $2, updated_at = NOW()
                 WHERE id = $3`,
                [timestamp, messageText, leadId]
            );

        } else {
            // LEAD NUEVO: INSERT
            console.log(`[Webhook] Creating NEW lead for chat ${externalChatId}`);

            // Intentamos buscar por teléfono si el chat no existía (para no duplicar contacto)
            // TODO: Fallback search by phone logic here if needed.

            const newLeadResult = await db.queryRaw(
                `INSERT INTO tasksleads_lead 
                 (id_tenant, full_name, phone, status, source, channel, last_activity_at, last_message_preview, created_at)
                 VALUES ($1, $2, $3, 'open', 'timelinesai', 'whatsapp', $4, $5, NOW())
                 RETURNING id`,
                [tenantId, senderName, senderPhone, timestamp, messageText]
            );

            leadId = newLeadResult.rows[0].id;

            // Crear Link
            await db.queryRaw(
                `INSERT INTO tasksleads_lead_timeline_link
                 (id_tenant, lead_id, timeline_external_id, timeline_phone, last_sync_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [tenantId, leadId, externalChatId, senderPhone]
            );

            // 6. Enviar Email (Solo si es nuevo)
            const emailSubject = `Nuevo lead WhatsApp - ${senderName || senderPhone}`;
            const emailBody = `
                Nuevo mensaje entrante:
                
                De: ${senderName} (${senderPhone})
                Mensaje: ${messageText}
                
                Chat ID: ${externalChatId}
                Fecha: ${timestamp.toLocaleString()}
            `;

            const emailHtml = `
                <h3>🟠 Nuevo Lead Detectado</h3>
                <p><strong>De:</strong> ${senderName || 'Desconocido'} (${senderPhone})</p>
                <p><strong>Mensaje:</strong></p>
                <blockquote style="background: #f5f5f5; padding: 10px; border-left: 4px solid #ff5f00;">
                    ${messageText}
                </blockquote>
                <p><small>ID: ${externalChatId}</small></p>
            `;

            await emailService.sendLeadNotificationEmail({
                subject: emailSubject,
                text: emailBody,
                html: emailHtml
            });
        }

        return res.status(200).json({ ok: true, lead_id: leadId, created: linkResult.rows.length === 0 });

    } catch (error) {
        console.error('[Webhook Error]', error);
        // Devuelve 200 intencionalmente
        return res.status(200).json({ ok: true, warning: 'Internal processing error', details: error.message });
    }
}

module.exports = {
    timelinesWebhook
};
