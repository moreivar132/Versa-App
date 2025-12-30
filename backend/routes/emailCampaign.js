/**
 * VERSA - Email Campaign Routes
 * API para gestión de campañas de email
 * 
 * Montaje: /api/marketing/campaigns
 */

const express = require('express');
const router = express.Router();
const emailCampaignService = require('../services/emailCampaignService');

/**
 * GET /api/marketing/campaigns
 * Listar campañas del tenant
 */
router.get('/', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const { status, limit } = req.query;

        const campaigns = await emailCampaignService.listCampaigns(
            idTenant,
            status || null,
            parseInt(limit) || 50
        );

        res.json({ ok: true, campaigns });
    } catch (error) {
        console.error('Error listando campañas:', error);
        res.status(500).json({ ok: false, error: 'Error al listar campañas' });
    }
});

/**
 * GET /api/marketing/campaigns/recipients
 * Obtener conteo de destinatarios según filtro
 */
router.get('/recipients', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const filter = req.query.filter ? JSON.parse(req.query.filter) : { type: 'all_members' };

        const recipients = await emailCampaignService.getRecipients(idTenant, filter);
        const count = recipients.length;

        res.json({
            ok: true,
            count,
            recipients: recipients.slice(0, 10) // Solo primeros 10 para preview
        });
    } catch (error) {
        console.error('Error obteniendo destinatarios:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener destinatarios' });
    }
});

/**
 * GET /api/marketing/campaigns/:id
 * Obtener detalle de campaña
 */
router.get('/:id', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const campaign = await emailCampaignService.getCampaign(
            parseInt(req.params.id),
            idTenant
        );

        if (!campaign) {
            return res.status(404).json({ ok: false, error: 'Campaña no encontrada' });
        }

        res.json({ ok: true, campaign });
    } catch (error) {
        console.error('Error obteniendo campaña:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener campaña' });
    }
});

/**
 * POST /api/marketing/campaigns
 * Crear nueva campaña
 */
router.post('/', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const userId = req.user.id;

        const campaign = await emailCampaignService.createCampaign(idTenant, {
            ...req.body,
            created_by: userId
        });

        res.status(201).json({ ok: true, campaign });
    } catch (error) {
        console.error('Error creando campaña:', error);
        res.status(500).json({ ok: false, error: 'Error al crear campaña' });
    }
});

/**
 * PUT /api/marketing/campaigns/:id
 * Actualizar campaña (solo borradores)
 */
router.put('/:id', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const campaign = await emailCampaignService.updateCampaign(
            parseInt(req.params.id),
            idTenant,
            req.body
        );

        res.json({ ok: true, campaign });
    } catch (error) {
        console.error('Error actualizando campaña:', error);
        if (error.message.includes('no encontrada') || error.message.includes('borrador')) {
            return res.status(400).json({ ok: false, error: error.message });
        }
        res.status(500).json({ ok: false, error: 'Error al actualizar campaña' });
    }
});

/**
 * DELETE /api/marketing/campaigns/:id
 * Eliminar campaña
 */
router.delete('/:id', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        await emailCampaignService.deleteCampaign(
            parseInt(req.params.id),
            idTenant
        );

        res.json({ ok: true, message: 'Campaña eliminada' });
    } catch (error) {
        console.error('Error eliminando campaña:', error);
        if (error.message.includes('no encontrada') || error.message.includes('Solo')) {
            return res.status(400).json({ ok: false, error: error.message });
        }
        res.status(500).json({ ok: false, error: 'Error al eliminar campaña' });
    }
});

/**
 * GET /api/marketing/campaigns/:id/preview
 * Previsualizar campaña con datos de ejemplo
 */
router.get('/:id/preview', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const preview = await emailCampaignService.previewCampaign(
            parseInt(req.params.id),
            idTenant
        );

        res.json({ ok: true, ...preview });
    } catch (error) {
        console.error('Error generando preview:', error);
        res.status(500).json({ ok: false, error: 'Error al generar preview' });
    }
});

/**
 * POST /api/marketing/campaigns/:id/send
 * Enviar campaña inmediatamente
 */
router.post('/:id/send', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const result = await emailCampaignService.sendCampaign(
            parseInt(req.params.id),
            idTenant
        );

        res.json({
            ok: true,
            message: `Campaña enviada: ${result.sent} exitosos, ${result.failed} fallidos`,
            ...result
        });
    } catch (error) {
        console.error('Error enviando campaña:', error);
        if (error.message.includes('no encontrada') || error.message.includes('ya fue')) {
            return res.status(400).json({ ok: false, error: error.message });
        }
        res.status(500).json({ ok: false, error: 'Error al enviar campaña' });
    }
});

/**
 * POST /api/marketing/campaigns/:id/schedule
 * Programar campaña
 */
router.post('/:id/schedule', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const { scheduled_at } = req.body;

        if (!scheduled_at) {
            return res.status(400).json({ ok: false, error: 'scheduled_at es requerido' });
        }

        const campaign = await emailCampaignService.scheduleCampaign(
            parseInt(req.params.id),
            idTenant,
            new Date(scheduled_at)
        );

        res.json({ ok: true, campaign });
    } catch (error) {
        console.error('Error programando campaña:', error);
        if (error.message.includes('no encontrada') || error.message.includes('borrador')) {
            return res.status(400).json({ ok: false, error: error.message });
        }
        res.status(500).json({ ok: false, error: 'Error al programar campaña' });
    }
});

/**
 * POST /api/marketing/campaigns/:id/cancel
 * Cancelar campaña
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const campaign = await emailCampaignService.cancelCampaign(
            parseInt(req.params.id),
            idTenant
        );

        res.json({ ok: true, campaign });
    } catch (error) {
        console.error('Error cancelando campaña:', error);
        if (error.message.includes('no encontrada') || error.message.includes('No se puede')) {
            return res.status(400).json({ ok: false, error: error.message });
        }
        res.status(500).json({ ok: false, error: 'Error al cancelar campaña' });
    }
});

module.exports = router;
