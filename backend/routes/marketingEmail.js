/**
 * VERSA - BLOQUE 7: Email Automations
 * Rutas API para gestión de plantillas y automatizaciones de email
 * 
 * Montaje: /api/marketing/email
 */

const express = require('express');
const router = express.Router();
const emailAutomationService = require('../services/emailAutomationService');

/**
 * GET /api/marketing/email/templates
 * Obtener plantillas (opcionalmente filtrar por code)
 */
router.get('/templates', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { code } = req.query;

        const templates = await emailAutomationService.getTemplates(id_tenant, code);

        // Agrupar por código, priorizando templates del tenant sobre globales
        const grouped = {};
        for (const t of templates) {
            if (!grouped[t.code] || t.id_tenant !== null) {
                grouped[t.code] = t;
            }
        }

        res.json({
            ok: true,
            templates: Object.values(grouped)
        });
    } catch (error) {
        console.error('Error obteniendo templates:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener plantillas' });
    }
});

/**
 * GET /api/marketing/email/templates/:code
 * Obtener una plantilla específica
 */
router.get('/templates/:code', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { code } = req.params;

        const templates = await emailAutomationService.getTemplates(id_tenant, code);

        // Priorizar template del tenant
        const template = templates.find(t => t.id_tenant === id_tenant) || templates[0];

        if (!template) {
            return res.status(404).json({ ok: false, error: 'Plantilla no encontrada' });
        }

        res.json({ ok: true, template });
    } catch (error) {
        console.error('Error obteniendo template:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener plantilla' });
    }
});

/**
 * PUT /api/marketing/email/templates/:code
 * Crear/actualizar plantilla para el tenant
 */
router.put('/templates/:code', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { code } = req.params;
        const { name, subject, html_body, text_body, variables_json, is_active } = req.body;

        if (!subject || !html_body) {
            return res.status(400).json({
                ok: false,
                error: 'Subject y html_body son requeridos'
            });
        }

        const template = await emailAutomationService.upsertTemplate(id_tenant, code, {
            name: name || code,
            subject,
            html_body,
            text_body,
            variables_json,
            is_active
        });

        res.json({ ok: true, template });
    } catch (error) {
        console.error('Error guardando template:', error);
        res.status(500).json({ ok: false, error: 'Error al guardar plantilla' });
    }
});

/**
 * POST /api/marketing/email/templates
 * Crear una nueva plantilla personalizada
 */
router.post('/templates', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { code, name, subject, html_body, text_body, variables_json, category, description, preview_text } = req.body;

        // Validaciones
        if (!code || !name || !subject || !html_body) {
            return res.status(400).json({
                ok: false,
                error: 'code, name, subject y html_body son requeridos'
            });
        }

        // Validar formato del código (solo letras, números y guiones bajos)
        if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
            return res.status(400).json({
                ok: false,
                error: 'El código debe ser MAYÚSCULAS con guiones bajos (ej: PROMO_NAVIDAD)'
            });
        }

        // Crear la plantilla
        const template = await emailAutomationService.createTemplate(id_tenant, {
            code,
            name,
            subject,
            html_body,
            text_body,
            variables_json: variables_json || '[]',
            is_system: false,
            category: category || 'marketing',
            description,
            preview_text
        });

        res.status(201).json({ ok: true, template });
    } catch (error) {
        console.error('Error creando template:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ ok: false, error: 'Ya existe una plantilla con ese código' });
        }
        res.status(500).json({ ok: false, error: 'Error al crear plantilla' });
    }
});

/**
 * DELETE /api/marketing/email/templates/:code
 * Eliminar una plantilla (solo no-system)
 */
router.delete('/templates/:code', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { code } = req.params;

        const deleted = await emailAutomationService.deleteTemplate(id_tenant, code);

        if (!deleted) {
            return res.status(404).json({
                ok: false,
                error: 'Plantilla no encontrada o es de sistema (no eliminable)'
            });
        }

        res.json({ ok: true, message: 'Plantilla eliminada' });
    } catch (error) {
        console.error('Error eliminando template:', error);
        res.status(500).json({ ok: false, error: 'Error al eliminar plantilla' });
    }
});

/**
 * GET /api/marketing/email/events
 * Listar eventos disponibles para triggers
 */
router.get('/events', async (req, res) => {
    const events = [
        { code: 'CLIENT_REGISTERED', name: 'Cliente registrado', description: 'Cuando un cliente se registra en el portal', variables: ['nombre', 'email'] },
        { code: 'PASSWORD_RESET_REQUESTED', name: 'Reset de contraseña', description: 'Cuando solicita recuperar contraseña', variables: ['nombre', 'reset_url'] },
        { code: 'APPOINTMENT_CREATED', name: 'Cita creada', description: 'Cuando se crea una nueva cita', variables: ['nombre', 'fecha_cita', 'hora_cita', 'servicio'] },
        { code: 'APPOINTMENT_REMINDER', name: 'Recordatorio de cita', description: 'Recordatorio antes de la cita', variables: ['nombre', 'fecha_cita', 'hora_cita'] },
        { code: 'ORDER_COMPLETED', name: 'Orden completada', description: 'Cuando una orden de trabajo se completa', variables: ['nombre', 'numero_orden', 'total'] },
        { code: 'MANUAL', name: 'Envío manual', description: 'Envío manual desde el panel', variables: ['nombre', 'email', 'custom'] }
    ];

    res.json({ ok: true, events });
});

/**
 * POST /api/marketing/email/automations
 * Crear una nueva automatización
 */
router.post('/automations', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { event_code, template_code, enabled, delay_seconds, trigger_type } = req.body;

        if (!event_code || !template_code) {
            return res.status(400).json({
                ok: false,
                error: 'event_code y template_code son requeridos'
            });
        }

        const automation = await emailAutomationService.createAutomation(id_tenant, {
            event_code,
            template_code,
            enabled: enabled !== false,
            delay_seconds: delay_seconds || 0,
            trigger_type: trigger_type || 'event'
        });

        res.status(201).json({ ok: true, automation });
    } catch (error) {
        console.error('Error creando automation:', error);
        if (error.code === '23505') {
            return res.status(409).json({ ok: false, error: 'Ya existe una automatización para ese evento' });
        }
        res.status(500).json({ ok: false, error: 'Error al crear automatización' });
    }
});

/**
 * DELETE /api/marketing/email/automations/:event_code
 * Eliminar una automatización
 */
router.delete('/automations/:event_code', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { event_code } = req.params;

        const deleted = await emailAutomationService.deleteAutomation(id_tenant, event_code);

        if (!deleted) {
            return res.status(404).json({ ok: false, error: 'Automatización no encontrada' });
        }

        res.json({ ok: true, message: 'Automatización eliminada' });
    } catch (error) {
        console.error('Error eliminando automation:', error);
        res.status(500).json({ ok: false, error: 'Error al eliminar automatización' });
    }
});

/**
 * GET /api/marketing/email/automations
 * Listar automatizaciones del tenant
 */
router.get('/automations', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const automations = await emailAutomationService.getAutomations(id_tenant);

        res.json({ ok: true, automations });
    } catch (error) {
        console.error('Error obteniendo automations:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener automatizaciones' });
    }
});

/**
 * PUT /api/marketing/email/automations/:event_code
 * Actualizar automatización
 */
router.put('/automations/:event_code', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { event_code } = req.params;
        const { enabled, template_code, delay_seconds } = req.body;

        const automation = await emailAutomationService.updateAutomation(id_tenant, event_code, {
            enabled,
            template_code,
            delay_seconds
        });

        if (!automation) {
            return res.status(404).json({ ok: false, error: 'Automatización no encontrada' });
        }

        res.json({ ok: true, automation });
    } catch (error) {
        console.error('Error actualizando automation:', error);
        res.status(500).json({ ok: false, error: 'Error al actualizar automatización' });
    }
});

/**
 * GET /api/marketing/email/logs
 * Obtener logs de emails enviados
 */
router.get('/logs', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        const logs = await emailAutomationService.getLogs(id_tenant, limit);

        res.json({ ok: true, logs });
    } catch (error) {
        console.error('Error obteniendo logs:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener logs' });
    }
});

/**
 * POST /api/marketing/email/test
 * Enviar email de prueba para verificar la configuración
 */
router.post('/test', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { to_email } = req.body;

        if (!to_email) {
            return res.status(400).json({
                ok: false,
                error: 'to_email es requerido'
            });
        }

        // Get config to verify webhook is set
        const config = await emailAutomationService.getConfig(id_tenant);
        if (!config || !config.webhook_url) {
            return res.status(400).json({
                ok: false,
                error: 'Webhook URL no configurado. Configúralo primero en la pestaña Configuración.'
            });
        }

        // Send test email directly via provider
        const makeEmailProvider = require('../services/makeEmailProvider');
        const result = await makeEmailProvider.sendEmail({
            to: to_email,
            subject: '✅ Email de Prueba - VERSA',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0d11; padding: 40px; border-radius: 12px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="https://i.imgur.com/Mjw4or5.png" alt="VERSA" style="height: 40px;">
                    </div>
                    <h1 style="color: #ff5f00; text-align: center; margin-bottom: 20px;">¡Configuración Correcta!</h1>
                    <p style="color: #ffffff; font-size: 16px; line-height: 1.6; text-align: center;">
                        Si estás viendo este email, tu configuración de webhook está funcionando correctamente.
                    </p>
                    <div style="background: rgba(255, 95, 0, 0.1); border: 1px solid rgba(255, 95, 0, 0.3); border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <p style="color: #9da6b9; margin: 0; font-size: 14px;">
                            <strong style="color: #ff5f00;">Webhook URL:</strong> ${config.webhook_url.substring(0, 50)}...
                        </p>
                        <p style="color: #9da6b9; margin: 10px 0 0 0; font-size: 14px;">
                            <strong style="color: #ff5f00;">Remitente:</strong> ${config.sender_name} &lt;${config.sender_email}&gt;
                        </p>
                    </div>
                    <p style="color: #6b7280; font-size: 12px; text-align: center;">
                        Este es un email de prueba enviado desde VERSA Marketing Automations.
                    </p>
                </div>
            `,
            text: 'Email de prueba - Tu configuración de webhook está funcionando correctamente.',
            meta: {
                id_tenant,
                type: 'TEST',
                webhook_url: config.webhook_url,
                sender_name: config.sender_name,
                sender_email: config.sender_email
            }
        });

        // Update last test status in config
        await emailAutomationService.updateConfigTestStatus(id_tenant, result.ok, result.error);

        if (result.ok) {
            res.json({ ok: true, message: 'Email de prueba enviado correctamente' });
        } else {
            res.status(500).json({ ok: false, error: result.error || 'Error enviando email' });
        }
    } catch (error) {
        console.error('Error enviando test email:', error);
        res.status(500).json({ ok: false, error: 'Error al enviar email de prueba' });
    }
});

/**
 * GET /api/marketing/email/config
 * Obtener configuración de email del tenant
 */
router.get('/config', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const config = await emailAutomationService.getConfig(id_tenant);

        res.json({
            ok: true,
            config: config || {
                webhook_url: '',
                sender_name: 'VERSA',
                sender_email: 'noreply@versa.app',
                enabled: false
            }
        });
    } catch (error) {
        console.error('Error obteniendo config:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener configuración' });
    }
});

/**
 * PUT /api/marketing/email/config
 * Guardar configuración de email del tenant
 */
router.put('/config', async (req, res) => {
    try {
        const id_tenant = req.user.id_tenant;
        const { webhook_url, sender_name, sender_email, enabled } = req.body;

        if (!webhook_url) {
            return res.status(400).json({
                ok: false,
                error: 'webhook_url es requerido'
            });
        }

        // Validate webhook URL format
        try {
            new URL(webhook_url);
        } catch (e) {
            return res.status(400).json({
                ok: false,
                error: 'URL de webhook inválida'
            });
        }

        const config = await emailAutomationService.upsertConfig(id_tenant, {
            webhook_url,
            sender_name: sender_name || 'VERSA',
            sender_email: sender_email || 'noreply@versa.app',
            enabled: enabled !== false
        });

        res.json({ ok: true, config });
    } catch (error) {
        console.error('Error guardando config:', error);
        res.status(500).json({ ok: false, error: 'Error al guardar configuración' });
    }
});

module.exports = router;

