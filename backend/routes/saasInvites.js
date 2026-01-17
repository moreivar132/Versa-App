/**
 * SaaS Invite Management Routes
 * API for creating and managing invitation tokens
 * 
 * Routes:
 *   POST   /api/saas/invites      - Create new invite (tenant admin)
 *   GET    /api/saas/invites      - List invites for tenant
 *   DELETE /api/saas/invites/:id  - Delete unused invite
 *   GET    /api/saas/invites/:id  - Get invite details
 */

const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const saasInviteService = require('../services/saasInviteService');

/**
 * POST /api/saas/invites
 * Create a new invitation for the current tenant
 * Body: { role?: string, emailAllowed?: string, empresaId?: number, expiryHours?: number }
 */
router.post('/', verifyJWT, async (req, res) => {
    try {
        // Must have a tenant
        if (!req.user.id_tenant) {
            return res.status(403).json({ error: 'Solo usuarios de empresa pueden crear invitaciones' });
        }

        const { role, emailAllowed, empresaId, expiryHours } = req.body;

        const result = await saasInviteService.createInvite({
            tenantId: req.user.id_tenant,
            role: role || 'CLIENT_ADMIN',
            emailAllowed: emailAllowed || null,
            empresaId: empresaId || null,
            expiryHours: expiryHours || 72,
            createdByUserId: req.user.id
        });

        // Build full invite URL - use accept-invite page instead of login
        const inviteUrl = saasInviteService.buildInviteUrl(result.token, '/accept-invite.html');

        res.status(201).json({
            ok: true,
            invite: {
                id: result.inviteId,
                url: inviteUrl,
                expiresAt: result.expiresAt,
                role: role || 'CLIENT_ADMIN',
                emailAllowed: emailAllowed || null,
                empresaId: empresaId || null
            }
        });
    } catch (error) {
        console.error('[InviteAPI] Create error:', error);
        res.status(500).json({ error: 'Error al crear invitación' });
    }
});

/**
 * GET /api/saas/invites
 * List all invites for current tenant
 * Query: ?active=true (only show unused, unexpired)
 */
router.get('/', verifyJWT, async (req, res) => {
    try {
        if (!req.user.id_tenant) {
            return res.status(403).json({ error: 'Solo usuarios de empresa pueden ver invitaciones' });
        }

        const activeOnly = req.query.active === 'true';
        const invites = await saasInviteService.listInvitesByTenant(req.user.id_tenant, activeOnly);

        res.json({ ok: true, invites });
    } catch (error) {
        console.error('[InviteAPI] List error:', error);
        res.status(500).json({ error: 'Error al listar invitaciones' });
    }
});

/**
 * GET /api/saas/invites/:id
 * Get details of a specific invite
 */
router.get('/:id', verifyJWT, async (req, res) => {
    try {
        if (!req.user.id_tenant) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const invite = await saasInviteService.getInviteById(parseInt(req.params.id));

        if (!invite) {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }

        // Verify tenant ownership
        if (invite.tenantId !== req.user.id_tenant && !req.user.is_super_admin) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        res.json({ ok: true, invite });
    } catch (error) {
        console.error('[InviteAPI] Get error:', error);
        res.status(500).json({ error: 'Error al obtener invitación' });
    }
});

/**
 * DELETE /api/saas/invites/:id
 * Delete an unused invite
 */
router.delete('/:id', verifyJWT, async (req, res) => {
    try {
        if (!req.user.id_tenant) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Get invite first to check ownership
        const invite = await saasInviteService.getInviteById(parseInt(req.params.id));

        if (!invite) {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }

        if (invite.tenantId !== req.user.id_tenant && !req.user.is_super_admin) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (invite.usedAt) {
            return res.status(400).json({ error: 'No se puede eliminar una invitación ya usada' });
        }

        await saasInviteService.deleteInvite(parseInt(req.params.id));

        res.json({ ok: true, message: 'Invitación eliminada' });
    } catch (error) {
        console.error('[InviteAPI] Delete error:', error);
        res.status(500).json({ error: 'Error al eliminar invitación' });
    }
});

module.exports = router;
