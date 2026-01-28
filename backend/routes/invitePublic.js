/**
 * Public Invite Routes
 * Public endpoints for invite verification and acceptance
 * 
 * Routes:
 *   GET  /api/invites/verify  - Verify invite token (public)
 *   POST /api/invites/accept  - Accept invite and create account (public)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { getSystemDb } = require('../src/core/db/tenant-db');
const saasInviteService = require('../services/saasInviteService');

/**
 * GET /api/invites/verify
 * Verify an invite token and return invite details
 * Public endpoint - no auth required
 */
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                ok: false,
                error: 'Token requerido',
                code: 'MISSING_TOKEN'
            });
        }

        // Hash the token to look it up
        const tokenHash = saasInviteService.hashInviteToken(token);

        // Find invite with tenant and empresa info
        const systemDb = getSystemDb();
        const result = await systemDb.query(`
            SELECT 
                si.id,
                si.tenant_id,
                si.id_empresa,
                si.role,
                si.email_allowed,
                si.expires_at,
                si.used_at,
                t.nombre as tenant_nombre,
                e.nombre_legal as empresa_nombre
            FROM saas_invite si
            JOIN tenant t ON si.tenant_id = t.id
            LEFT JOIN accounting_empresa e ON si.id_empresa = e.id
            WHERE si.token_hash = $1
        `, [tokenHash]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Invitación no encontrada',
                code: 'NOT_FOUND'
            });
        }

        const invite = result.rows[0];

        // Check if already used
        if (invite.used_at) {
            return res.status(400).json({
                ok: false,
                error: 'Esta invitación ya fue utilizada',
                code: 'ALREADY_USED'
            });
        }

        // Check if expired
        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({
                ok: false,
                error: 'Esta invitación ha expirado',
                code: 'EXPIRED'
            });
        }

        // Return invite details (never return the token hash)
        res.json({
            ok: true,
            invite: {
                email: invite.email_allowed || null,
                emailRequired: !!invite.email_allowed,
                tenant: {
                    id: invite.tenant_id,
                    nombre: invite.tenant_nombre
                },
                empresa: invite.id_empresa ? {
                    id: invite.id_empresa,
                    nombre: invite.empresa_nombre
                } : null,
                role: invite.role,
                expiresAt: invite.expires_at
            }
        });

    } catch (error) {
        console.error('[InvitePublic] Verify error:', error);
        res.status(500).json({ ok: false, error: 'Error al verificar invitación' });
    }
});

/**
 * POST /api/invites/accept
 * Accept an invite and create a new user account
 * Public endpoint - no auth required
 */
router.post('/accept', async (req, res) => {
    const systemDb = getSystemDb({ reason: 'invite_acceptance' });

    try {
        const { token, password, nombre, email } = req.body;

        // Validate required fields
        if (!token) {
            return res.status(400).json({ ok: false, error: 'Token requerido' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ ok: false, error: 'Contraseña debe tener al menos 6 caracteres' });
        }
        if (!nombre || nombre.trim().length < 2) {
            return res.status(400).json({ ok: false, error: 'Nombre requerido' });
        }

        const result = await systemDb.txWithRLS(async (tx) => {
            // Hash the token
            const tokenHash = saasInviteService.hashInviteToken(token);

            // Get and lock the invite row
            const inviteResult = await tx.query(`
                SELECT 
                    si.*,
                    t.nombre as tenant_nombre,
                    e.nombre_legal as empresa_nombre
                FROM saas_invite si
                JOIN tenant t ON si.tenant_id = t.id
                LEFT JOIN accounting_empresa e ON si.id_empresa = e.id
                WHERE si.token_hash = $1
                FOR UPDATE OF si
            `, [tokenHash]);

            if (inviteResult.rows.length === 0) {
                return { status: 404, data: { ok: false, error: 'Invitación no encontrada' } };
            }

            const invite = inviteResult.rows[0];

            // Validate invite is usable
            if (invite.used_at) {
                return { status: 400, data: { ok: false, error: 'Esta invitación ya fue utilizada' } };
            }

            if (new Date(invite.expires_at) < new Date()) {
                return { status: 400, data: { ok: false, error: 'Esta invitación ha expirado' } };
            }

            // Determine the email to use
            let userEmail;
            if (invite.email_allowed) {
                userEmail = invite.email_allowed.toLowerCase().trim();
            } else if (email) {
                userEmail = email.toLowerCase().trim();
            } else {
                return { status: 400, data: { ok: false, error: 'Email requerido' } };
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userEmail)) {
                return { status: 400, data: { ok: false, error: 'Email inválido' } };
            }

            // Check if email already exists
            const existingUser = await tx.query(
                'SELECT id FROM usuario WHERE LOWER(email) = $1',
                [userEmail]
            );

            if (existingUser.rows.length > 0) {
                return {
                    status: 400,
                    data: {
                        ok: false,
                        error: 'Ya existe una cuenta con este email. Intenta iniciar sesión.',
                        code: 'EMAIL_EXISTS'
                    }
                };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Create user
            const userResult = await tx.query(`
                INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin)
                VALUES ($1, $2, $3, $4, false)
                RETURNING id, id_tenant, nombre, email
            `, [invite.tenant_id, nombre.trim(), userEmail, passwordHash]);

            const newUser = userResult.rows[0];

            // Assign role from invite
            const roleResult = await tx.query(
                'SELECT id FROM rol WHERE nombre = $1',
                [invite.role]
            );

            if (roleResult.rows.length > 0) {
                await tx.query(
                    'INSERT INTO usuariorol (id_usuario, id_rol, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [newUser.id, roleResult.rows[0].id, invite.tenant_id]
                );
            }

            // If empresa specified, assign user to empresa
            if (invite.id_empresa) {
                await tx.query(`
                    INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa, created_by)
                    VALUES ($1, $2, $3, $1)
                    ON CONFLICT (id_usuario, id_empresa) DO NOTHING
                `, [newUser.id, invite.id_empresa, 'empresa_lector']);
            }

            // Mark invite as used
            await tx.query(`
                UPDATE saas_invite 
                SET used_at = NOW(), used_by_user_id = $1
                WHERE id = $2
            `, [newUser.id, invite.id]);

            return {
                status: 201,
                data: {
                    ok: true,
                    message: 'Cuenta creada correctamente',
                    user: {
                        id: newUser.id,
                        email: newUser.email,
                        nombre: newUser.nombre
                    },
                    tenant: {
                        id: invite.tenant_id,
                        nombre: invite.tenant_nombre
                    }
                }
            };
        });

        // Send response based on transaction result
        res.status(result.status).json(result.data);

    } catch (error) {
        console.error('[InvitePublic] Accept error:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al crear cuenta',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
