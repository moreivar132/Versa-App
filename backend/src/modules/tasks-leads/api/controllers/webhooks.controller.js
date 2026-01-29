const { getTenantDb } = require('../../../../core/database/postgres/client');
const emailService = require('../../../../services/emailService');
const classifierService = require('../../application/services/leadClassifierService');
const timelinesService = require('../../application/services/timelinesService');

/**
 * Webhook handler for TimelinesAI
 * Recibe mensajes entrantes, crea Leads si es necesario y dispara clasficación
 */
async function timelinesWebhook(req, res) {
    const db = getTenantDb({ tenantId: 1 }); // Default to tenant 1 for webhook context
    const payload = req.body;

    // console.log('[Webhook Payload]', JSON.stringify(payload, null, 2));

    try {
        // Validación básica
        if (!payload || !payload.message || !payload.chat) {
            console.warn('[Webhook] Invalid payload structure');
            return res.status(200).json({ ok: false, reason: 'ignored_structure' });
        }

        const messageData = payload.message;
        const chatData = payload.chat;

        // Solo nos interesan mensajes RECIBIDOS (no enviados por nosotros)
        if (messageData.direction !== 'received') {
            return res.status(200).json({ ok: true, ignored: 'direction_sent' });
        }

        const externalChatId = chatData.id || chatData.uid; // Timelines ID
        const senderPhone = chatData.phone || chatData.whatsapp_id;
        const senderName = chatData.full_name || chatData.name || 'Desconocido';
        const messageText = messageData.text || '';
        const timestamp = new Date();
        const isGroup = chatData.is_group || false;

        if (isGroup) {
            console.log('[Webhook Skipped] Group message');
            return res.status(200).json({ ok: true, ignored: 'group' });
        }

        // ===========================================
        // 5. GESTION DE LEADS (Buscar o Crear)
        // ===========================================

        // Primero buscamos si ya existe el link con Timeline
        const linkResult = await db.queryRaw(
            `SELECT lead_id, id_tenant FROM tasksleads_lead_timeline_link WHERE timeline_external_id = $1 LIMIT 1`,
            [externalChatId]
        );

        let leadId = null;
        let tenantId = 1;

        if (linkResult.rows.length > 0) {
            // LEAD YA VINCULADO: UPDATE
            leadId = linkResult.rows[0].lead_id;
            tenantId = linkResult.rows[0].id_tenant;

            console.log(`[Webhook] Updating existing linked lead ${leadId}`);

            await db.queryRaw(
                `UPDATE tasksleads_lead 
                 SET last_activity_at = $1, last_message_preview = $2, updated_at = NOW()
                 WHERE id = $3`,
                [timestamp, messageText, leadId]
            );

        } else {
            // NO HAY LINK: Buscar si existe Lead por telefono (evitar duplicados)
            console.log(`[Webhook] No link found for chat ${externalChatId}. Check logic...`);

            let existingLead = null;
            if (senderPhone) {
                const phoneResult = await db.queryRaw(
                    `SELECT id, id_tenant FROM tasksleads_lead WHERE phone = $1 LIMIT 1`,
                    [senderPhone]
                );
                if (phoneResult.rows.length > 0) {
                    existingLead = phoneResult.rows[0];
                }
            }

            if (existingLead) {
                // YA EXISTÍA EL LEAD (pero sin link)
                console.log(`[Webhook] ✅ Found existing lead by phone: ${existingLead.id}. Linking...`);
                leadId = existingLead.id;
                tenantId = existingLead.id_tenant;

                await db.queryRaw(
                    `UPDATE tasksleads_lead 
                      SET last_activity_at = $1, last_message_preview = $2, updated_at = NOW()
                      WHERE id = $3`,
                    [timestamp, messageText, leadId]
                );
            } else {
                // COMPLETAMENTE NUEVO
                console.log(`[Webhook] Creating NEW lead for chat ${externalChatId}`);

                const newLeadResult = await db.queryRaw(
                    `INSERT INTO tasksleads_lead 
                     (id_tenant, full_name, phone, status, source, channel, last_activity_at, last_message_preview, created_at)
                     VALUES ($1, $2, $3, 'open', 'timelinesai', 'whatsapp', $4, $5, NOW())
                     RETURNING id`,
                    [tenantId, senderName, senderPhone, timestamp, messageText]
                );
                leadId = newLeadResult.rows[0].id;
            }

            // CREAR LINK (Siempre)
            await db.queryRaw(
                `INSERT INTO tasksleads_lead_timeline_link
                 (id_tenant, lead_id, timeline_external_id, timeline_phone, last_sync_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (timeline_external_id) DO NOTHING`,
                [tenantId, leadId, externalChatId, senderPhone]
            );
        }

        // ===========================================
        // 6. ENVIAR EMAIL DE NOTIFICACIÓN
        // ===========================================

        // Link directo al chat en Timelines
        const chatUrl = `https://app.timelines.ai/chat/${externalChatId}`;

        const emailSubject = `Nuevo mensaje WhatsApp - ${senderName || senderPhone}`;
        const emailBody = `
De: ${senderName} (${senderPhone})
Mensaje:
"${messageText}"

Ver Chat: ${chatUrl}
        `;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #d97706;">🟠 Nuevo Mensaje Detectado</h2>
                <p><strong>De:</strong> ${senderName} (${senderPhone})</p>
                <div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #d97706; margin: 10px 0;">
                    ${messageText.replace(/\n/g, '<br>')}
                </div>
                <p style="margin-top: 20px;">
                    <a href="${chatUrl}" target="_blank" style="background-color: #3b82f6; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        💬 Responder en WhatsApp
                    </a>
                </p>
                <p style="font-size: 12px; color: #888; margin-top: 10px;">ID: ${externalChatId}</p>
            </div>
        `;

        console.log(`[Webhook] Prepared email for ${senderName}. Firing async...`);

        emailService.sendLeadNotificationEmail({
            subject: emailSubject,
            text: emailBody,
            html: emailHtml
        }).then(sent => {
            if (sent) console.log("[Webhook] Email notification sent OK");
            else console.error("[Webhook] Email notification FAILED");
        }).catch(emailErr => {
            console.error("[Webhook] Email send error:", emailErr.message);
        });

        // ===========================================
        // 7. FASE 2: AUTO CLASIFICACIÓN Y SYNC (Async)
        // ===========================================

        (async () => {
            // Esta función se ejecuta en "background" tras responder al webhook
            try {
                // A) Clasificar
                const classification = classifierService.classifyMessage(messageText);
                const { tags, aiProfile } = classification;

                if (tags.length > 0 || aiProfile.categoria_principal) {
                    console.log(`[Webhook AI] Detected tags for lead ${leadId}:`, tags);

                    // B) Guardar Tags en DB
                    for (const tag of tags) {
                        try {
                            await db.queryRaw(
                                `INSERT INTO tasksleads_lead_tag (id_tenant, lead_id, tag) VALUES ($1, $2, $3)
                                 ON CONFLICT (lead_id, tag) DO NOTHING`,
                                [tenantId, leadId, tag]
                            );
                        } catch (e) { /* Ignore duplicate */ }
                    }

                    // C) Guardar Perfil AI
                    await db.queryRaw(`
                        INSERT INTO tasksleads_lead_ai (id_tenant, lead_id, categoria_principal, verticales_interes, intencion, urgencia, resumen, confianza, last_analysis_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                        ON CONFLICT (lead_id) DO UPDATE SET
                            categoria_principal = EXCLUDED.categoria_principal,
                            verticales_interes = EXCLUDED.verticales_interes,
                            intencion = EXCLUDED.intencion,
                            urgencia = EXCLUDED.urgencia,
                            resumen = EXCLUDED.resumen,
                            last_analysis_at = NOW()
                    `, [
                        tenantId, leadId,
                        aiProfile.categoria_principal,
                        JSON.stringify(aiProfile.verticales_interes),
                        aiProfile.intencion,
                        aiProfile.urgencia,
                        aiProfile.resumen,
                        aiProfile.confianza
                    ]);

                    // D) TimelinesAI Sync (REAL)
                    // 1. Añadir etiqueta principal (OJO con límites API, probaremos añadir el primer tag relevante)
                    if (tags.length > 0) {
                        await timelinesService.addLabelToChat(externalChatId, tags[0]);
                    }

                    // 2. Enviar Nota con Resumen
                    const noteContent = `🤖 [VERSA AI] Análisis:\nCategoría: ${aiProfile.categoria_principal}\nIntención: ${aiProfile.intencion}\nResumen: ${aiProfile.resumen}`;
                    await timelinesService.sendNoteToChat(externalChatId, noteContent);
                }

            } catch (aiError) {
                console.error('[Webhook AI] Error in async classification:', aiError);
            }
        })();

        // Respondemos al webhook rápido
        return res.status(200).json({ ok: true, lead_id: leadId });

    } catch (error) {
        console.error('[Webhook Error]', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    timelinesWebhook
};
