// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const { getTenantDb } = require('../src/core/db/tenant-db');
const timelinesService = require('../services/timelinesService');

// Middleware: Inject req.db with loose tenant requirement (Webhooks/Public)
router.use((req, res, next) => {
    // WhatsApp webhooks and public endpoints might not have tenant context
    // We allow no tenant to simulate the previous 'pool' behavior (raw access)
    // If specific routes need strict tenant, they should check req.user or similar
    req.db = getTenantDb(req.ctx, { allowNoTenant: true });
    next();
});

/**
 * POST /api/whatsapp/contact
 * Endpoint para enviar el primer mensaje desde el formulario web
 */
router.post('/contact', async (req, res) => {
    const { nombre, telefono_cliente, mensaje_cliente } = req.body;

    // Validaciones
    if (!telefono_cliente || !mensaje_cliente) {
        return res.status(400).json({
            ok: false,
            error: 'El teléfono y el mensaje son obligatorios',
        });
    }

    // Validar formato internacional del teléfono
    if (!telefono_cliente.startsWith('+')) {
        return res.status(400).json({
            ok: false,
            error: 'El teléfono debe estar en formato internacional (ejemplo: +34600111222)',
        });
    }

    try {
        // 1. Enviar el mensaje inicial a través de TimelinesAI
        console.log(`📱 Enviando mensaje inicial a ${telefono_cliente}`);
        const timelinesResponse = await timelinesService.sendInitialMessage(
            telefono_cliente,
            mensaje_cliente
        );

        console.log('✅ Respuesta de TimelinesAI:', timelinesResponse);

        // 2. Extraer el chat_id de la respuesta (puede variar según la API)
        const chatId = timelinesResponse.chat_id || timelinesResponse.id || `whatsapp_${telefono_cliente}`;

        // 3. Guardar el chat en nuestra base de datos
        const chatResult = await req.db.query(
            `INSERT INTO whatsapp_chats (chat_id, phone, nombre, label, origen)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chat_id) 
       DO UPDATE SET 
         nombre = COALESCE(EXCLUDED.nombre, whatsapp_chats.nombre),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
            [chatId, telefono_cliente, nombre || null, timelinesService.LABEL_ORIGEN, 'Manager']
        );

        // 4. Guardar el mensaje inicial del cliente en la BD
        await req.db.query(
            `INSERT INTO whatsapp_messages (chat_id, phone, message_text, sender_type, sender_name)
       VALUES ($1, $2, $3, $4, $5)`,
            [chatId, telefono_cliente, mensaje_cliente, 'client', nombre || 'Cliente']
        );

        // 5. Guardar nuestra respuesta automática
        await req.db.query(
            `INSERT INTO whatsapp_messages (chat_id, phone, message_text, sender_type, sender_name)
       VALUES ($1, $2, $3, $4, $5)`,
            [
                chatId,
                telefono_cliente,
                `Hola, soy VERSA. Has enviado este mensaje desde la web: "${mensaje_cliente}". Te respondo por aquí.`,
                'operator',
                'VERSA Bot',
            ]
        );

        res.json({
            ok: true,
            message: 'Te hemos escrito por WhatsApp. Revisa tu WhatsApp para continuar la conversación.',
            chat: chatResult.rows[0],
            timelines_response: timelinesResponse,
        });
    } catch (error) {
        console.error('❌ Error al enviar mensaje inicial:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al enviar el mensaje por WhatsApp',
            details: error.message,
        });
    }
});

/**
 * POST /api/whatsapp/webhook
 * Webhook para recibir eventos de TimelinesAI
 */
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;
        console.log('📨 Webhook recibido de TimelinesAI:', JSON.stringify(event, null, 2));

        // Verificar el tipo de evento
        if (event.event === 'message:received:new') {
            const { chat_id, phone, text, sender_name } = event.data || {};

            if (!chat_id || !phone || !text) {
                console.warn('⚠️ Evento de mensaje incompleto:', event);
                return res.status(200).json({ ok: true, message: 'Evento sin datos completos' });
            }

            // 1. Asegurar que el chat existe en nuestra BD
            await req.db.query(
                `INSERT INTO whatsapp_chats (chat_id, phone, nombre, label, origen)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (chat_id) 
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
                [chat_id, phone, sender_name || null, timelinesService.LABEL_ORIGEN, 'Manager']
            );

            // 2. Guardar el mensaje recibido
            await req.db.query(
                `INSERT INTO whatsapp_messages (chat_id, phone, message_text, sender_type, sender_name, timelines_message_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    chat_id,
                    phone,
                    text,
                    'client',
                    sender_name || 'Cliente',
                    event.data.message_id || null,
                    JSON.stringify(event.data),
                ]
            );

            // 3. Opcional: Asegurar que el chat tenga la etiqueta "Manager"
            try {
                await timelinesService.updateChatLabels(chat_id, [timelinesService.LABEL_ORIGEN]);
            } catch (labelError) {
                console.warn('⚠️ No se pudo actualizar la etiqueta del chat:', labelError.message);
            }

            console.log(`✅ Mensaje guardado de ${phone}: ${text}`);
        }

        // Siempre devolver 200 OK para que TimelinesAI no reintente
        res.status(200).json({ ok: true, message: 'Webhook procesado' });
    } catch (error) {
        console.error('❌ Error procesando webhook:', error);
        // Aun así devolvemos 200 para evitar reintentos innecesarios
        res.status(200).json({ ok: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/send
 * Endpoint para que un operador envíe un mensaje desde el Manager
 */
router.post('/send', async (req, res) => {
    const { chat_id, message, sender_name } = req.body;

    if (!chat_id || !message) {
        return res.status(400).json({
            ok: false,
            error: 'El chat_id y el mensaje son obligatorios',
        });
    }

    try {
        // 1. Enviar el mensaje a través de TimelinesAI
        const timelinesResponse = await timelinesService.sendMessage(chat_id, message);

        // 2. Obtener el teléfono del chat
        const chatResult = await req.db.query(
            'SELECT phone FROM whatsapp_chats WHERE chat_id = $1',
            [chat_id]
        );

        if (chatResult.rows.length === 0) {
            throw new Error('Chat no encontrado en la base de datos');
        }

        const phone = chatResult.rows[0].phone;

        // 3. Guardar el mensaje en nuestra BD
        await req.db.query(
            `INSERT INTO whatsapp_messages (chat_id, phone, message_text, sender_type, sender_name, timelines_message_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                chat_id,
                phone,
                message,
                'operator',
                sender_name || 'Operador',
                timelinesResponse.message_id || null,
            ]
        );

        res.json({
            ok: true,
            message: 'Mensaje enviado correctamente',
            timelines_response: timelinesResponse,
        });
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al enviar el mensaje',
            details: error.message,
        });
    }
});

/**
 * GET /api/whatsapp/chats
 * Obtiene todos los chats
 */
router.get('/chats', async (req, res) => {
    try {
        const result = await req.db.query(
            `SELECT * FROM whatsapp_chats 
       ORDER BY updated_at DESC`
        );

        res.json({
            ok: true,
            chats: result.rows,
        });
    } catch (error) {
        console.error('❌ Error al obtener chats:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener los chats',
            details: error.message,
        });
    }
});

/**
 * GET /api/whatsapp/messages/:chat_id
 * Obtiene los mensajes de un chat específico
 */
router.get('/messages/:chat_id', async (req, res) => {
    const { chat_id } = req.params;

    try {
        const result = await req.db.query(
            `SELECT * FROM whatsapp_messages 
       WHERE chat_id = $1 
       ORDER BY created_at ASC`,
            [chat_id]
        );

        res.json({
            ok: true,
            messages: result.rows,
        });
    } catch (error) {
        console.error('❌ Error al obtener mensajes:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener los mensajes',
            details: error.message,
        });
    }
});

module.exports = router;
