const express = require('express');
const router = express.Router();
// const pool = require('../db'); // REMOVED
const { getTenantDb } = require('../src/core/db/tenant-db');
// const verifyJWT = require('../middleware/auth'); // Middleware de auth para usuarios CRM

// Middleware wrapper for dev
const devVerifyJWT = (req, res, next) => {
    // Try standard auth first
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.user = payload;
            return next();
        } catch (e) {
            console.log('Token invalid, falling back to dev user');
        }
    }

    // Fallback for dev
    req.user = {
        id: 8,
        id_tenant: 1,
        email: 'admin@versa.com',
        nombre: 'Admin Dev',
        is_super_admin: true
    };
    next();
};

// Aplicar middleware de autenticación a todas las rutas
router.use(devVerifyJWT);

// Inject req.db middleware
router.use((req, res, next) => {
    // Ensure req.ctx exists (if not set by global middleware)
    if (!req.ctx && req.user) {
        req.ctx = {
            tenantId: req.user.id_tenant,
            userId: req.user.id,
            userEmail: req.user.email,
            isSuperAdmin: req.user.is_super_admin
        };
    }
    // Inject tenant-safe db
    req.db = getTenantDb(req.ctx);
    next();
});

// 2.1. Listar conversaciones del tenant
router.get('/conversaciones', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant; // Asumimos que verifyJWT popula req.user
        const { estado, search } = req.query;

        let query = `
            SELECT
                c.id,
                c.id_cliente as "clienteId",
                cf.nombre AS "clienteNombre",
                cf.telefono AS "clienteTelefono",
                c.estado,
                c.ultimo_mensaje_at as "ultimoMensajeAt",
                (
                    SELECT texto
                    FROM chat_mensaje m
                    WHERE m.id_conversacion = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS "ultimoMensajeTexto"
            FROM chat_conversacion c
            LEFT JOIN clientefinal cf ON cf.id = c.id_cliente
            WHERE c.id_tenant = $1
        `;

        const params = [idTenant];
        let paramIndex = 2;

        if (estado) {
            query += ` AND c.estado = $${paramIndex}`;
            params.push(estado);
            paramIndex++;
        }

        if (search) {
            query += ` AND (cf.nombre ILIKE $${paramIndex} OR cf.telefono ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY c.ultimo_mensaje_at DESC NULLS LAST`;

        const result = await req.db.query(query, params);

        res.json({
            conversaciones: result.rows
        });

    } catch (error) {
        console.error('Error en GET /crm/chat/conversaciones:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 2.2. Ver historial de una conversación (CRM)
router.get('/conversaciones/:id/mensajes', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idConversacion = req.params.id;

        // Validar acceso (tenant)
        const queryConversacion = `
            SELECT
                c.id,
                c.estado,
                c.id_cliente as "clienteId",
                cf.nombre AS "clienteNombre",
                cf.telefono AS "clienteTelefono"
            FROM chat_conversacion c
            LEFT JOIN clientefinal cf ON cf.id = c.id_cliente
            WHERE c.id = $1 AND c.id_tenant = $2
        `;
        const resultConversacion = await req.db.query(queryConversacion, [idConversacion, idTenant]);

        if (resultConversacion.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }
        const conversacion = resultConversacion.rows[0];

        // Obtener mensajes
        const queryMensajes = `
            SELECT
                m.id,
                m.emisor_tipo as "emisorTipo",
                m.id_usuario as "idUsuario",
                u.nombre as "usuarioNombre",
                m.texto,
                m.tipo_mensaje as "tipoMensaje",
                m.url_adjunto as "urlAdjunto",
                m.created_at as "createdAt"
            FROM chat_mensaje m
            LEFT JOIN usuario u ON u.id = m.id_usuario
            WHERE m.id_conversacion = $1
            ORDER BY m.created_at ASC
        `;
        const resultMensajes = await req.db.query(queryMensajes, [idConversacion]);

        res.json({
            conversacion,
            mensajes: resultMensajes.rows
        });

    } catch (error) {
        console.error('Error en GET /crm/chat/conversaciones/:id/mensajes:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 2.3. Enviar mensaje desde el CRM
router.post('/conversaciones/:id/mensajes', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idUsuario = req.user.id;
        const idConversacion = req.params.id;
        const { texto, tipoMensaje, urlAdjunto } = req.body;

        // Validar acceso
        const queryValidar = `SELECT id FROM chat_conversacion WHERE id = $1 AND id_tenant = $2`;
        const resultValidar = await req.db.query(queryValidar, [idConversacion, idTenant]);

        if (resultValidar.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }

        // Insertar mensaje
        const queryInsert = `
            INSERT INTO chat_mensaje (
                id_conversacion, id_usuario, emisor_tipo, texto, tipo_mensaje, url_adjunto, created_at
            ) VALUES (
                $1, $2, 'USUARIO', $3, $4, $5, NOW()
            )
            RETURNING id, created_at
        `;

        const tipo = tipoMensaje || 'TEXTO';
        const url = urlAdjunto || null;

        const resultInsert = await req.db.query(queryInsert, [idConversacion, idUsuario, texto || '', tipo, url]);
        const nuevoMensaje = resultInsert.rows[0];

        // Actualizar conversación
        await req.db.query(`
            UPDATE chat_conversacion
            SET ultimo_mensaje_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [idConversacion]);

        res.json({
            ok: true,
            mensaje: {
                id: nuevoMensaje.id,
                idConversacion,
                emisorTipo: 'USUARIO',
                texto: texto || '',
                tipoMensaje: tipo,
                urlAdjunto: url,
                createdAt: nuevoMensaje.created_at
            }
        });

    } catch (error) {
        console.error('Error en POST /crm/chat/conversaciones/:id/mensajes:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 2.4. Cerrar conversación (con mensaje automático al cliente)
router.patch('/conversaciones/:id/cerrar', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idUsuario = req.user.id;
        const idConversacion = req.params.id;

        // Validar acceso
        const queryValidar = `SELECT id, estado FROM chat_conversacion WHERE id = $1 AND id_tenant = $2`;
        const resultValidar = await req.db.query(queryValidar, [idConversacion, idTenant]);

        if (resultValidar.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }

        // Enviar mensaje automático de cierre al cliente
        const mensajeCierre = `✅ Gracias por contactarnos. Esperamos haber resuelto tus dudas. Esta conversación ha sido cerrada. Si necesitas ayuda adicional, no dudes en escribirnos nuevamente. ¡Hasta pronto!`;

        await req.db.query(`
            INSERT INTO chat_mensaje (
                id_conversacion, id_usuario, emisor_tipo, texto, tipo_mensaje, created_at
            ) VALUES (
                $1, $2, 'USUARIO', $3, 'TEXTO', NOW()
            )
        `, [idConversacion, idUsuario, mensajeCierre]);

        // Actualizar estado a CERRADO
        const queryUpdate = `
            UPDATE chat_conversacion
            SET estado = 'CERRADO', updated_at = NOW(), ultimo_mensaje_at = NOW()
            WHERE id = $1 AND id_tenant = $2
            RETURNING id, estado
        `;
        const resultUpdate = await req.db.query(queryUpdate, [idConversacion, idTenant]);

        res.json({
            ok: true,
            conversacion: resultUpdate.rows[0],
            mensajeCierreEnviado: true
        });

    } catch (error) {
        console.error('Error en PATCH /crm/chat/conversaciones/:id/cerrar:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 2.5. Reabrir conversación cerrada
router.patch('/conversaciones/:id/reabrir', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idConversacion = req.params.id;

        // Validar y actualizar
        const queryUpdate = `
            UPDATE chat_conversacion
            SET estado = 'ABIERTO', updated_at = NOW()
            WHERE id = $1 AND id_tenant = $2
            RETURNING id, estado
        `;
        const resultUpdate = await req.db.query(queryUpdate, [idConversacion, idTenant]);

        if (resultUpdate.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }

        res.json({
            ok: true,
            conversacion: resultUpdate.rows[0]
        });

    } catch (error) {
        console.error('Error en PATCH /crm/chat/conversaciones/:id/reabrir:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
