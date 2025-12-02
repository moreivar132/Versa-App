const express = require('express');
const router = express.Router();
const pool = require('../db');
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
        id: 1,
        id_tenant: 1,
        email: 'admin@versa.com',
        nombre: 'Admin Dev',
        is_super_admin: true
    };
    next();
};

// Aplicar middleware de autenticación a todas las rutas
router.use(devVerifyJWT);

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

        const result = await pool.query(query, params);

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
        const resultConversacion = await pool.query(queryConversacion, [idConversacion, idTenant]);

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
                m.created_at as "createdAt"
            FROM chat_mensaje m
            LEFT JOIN usuario u ON u.id = m.id_usuario
            WHERE m.id_conversacion = $1
            ORDER BY m.created_at ASC
        `;
        const resultMensajes = await pool.query(queryMensajes, [idConversacion]);

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
        const { texto } = req.body;

        if (!texto) {
            return res.status(400).json({ ok: false, error: 'Falta el texto' });
        }

        // Validar acceso
        const queryValidar = `SELECT id FROM chat_conversacion WHERE id = $1 AND id_tenant = $2`;
        const resultValidar = await pool.query(queryValidar, [idConversacion, idTenant]);

        if (resultValidar.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }

        // Insertar mensaje
        const queryInsert = `
            INSERT INTO chat_mensaje (
                id_conversacion, id_usuario, emisor_tipo, texto, created_at
            ) VALUES (
                $1, $2, 'USUARIO', $3, NOW()
            )
            RETURNING id, created_at
        `;
        const resultInsert = await pool.query(queryInsert, [idConversacion, idUsuario, texto]);
        const nuevoMensaje = resultInsert.rows[0];

        // Actualizar conversación
        await pool.query(`
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
                texto,
                createdAt: nuevoMensaje.created_at
            }
        });

    } catch (error) {
        console.error('Error en POST /crm/chat/conversaciones/:id/mensajes:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 2.4. Cerrar conversación
router.patch('/conversaciones/:id/cerrar', async (req, res) => {
    try {
        const idTenant = req.user.id_tenant;
        const idConversacion = req.params.id;

        // Validar y actualizar
        const queryUpdate = `
            UPDATE chat_conversacion
            SET estado = 'CERRADO', updated_at = NOW()
            WHERE id = $1 AND id_tenant = $2
            RETURNING id, estado
        `;
        const resultUpdate = await pool.query(queryUpdate, [idConversacion, idTenant]);

        if (resultUpdate.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }

        res.json({
            ok: true,
            conversacion: resultUpdate.rows[0]
        });

    } catch (error) {
        console.error('Error en PATCH /crm/chat/conversaciones/:id/cerrar:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
