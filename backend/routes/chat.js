const express = require('express');
const router = express.Router();
// const pool = require('../db'); // REMOVED
const { getTenantDb } = require('../src/core/db/tenant-db');

// Middleware to setup Tenant DB context
router.use((req, res, next) => {
    // Logic extracted/adapted from getClientContext
    let id_tenant = req.headers['x-tenant-id'];
    if (!id_tenant && req.body && req.body.idTenant) {
        id_tenant = req.body.idTenant;
    }
    // Default to 1 (Super Admin/System) if not provided, matching original logic
    id_tenant = id_tenant || 1;

    const id_cliente = req.headers['x-client-id'] || null;

    req.ctx = {
        tenantId: id_tenant,
        userId: id_cliente ? `client-${id_cliente}` : 'anonymous-client' // For audit logs
    };

    // Inject DB wrapper
    req.db = getTenantDb(req.ctx);
    next();
});

const getClientContext = (req) => {
    // Helper to get IDs for logic (now consistent with middleware)
    const idTenant = req.ctx.tenantId;
    const idCliente = req.headers['x-client-id'] || 1; // Default to 1 if not provided, matching original logic
    return { idTenant, idCliente };
};

// 1.0. Identificar o crear cliente para el chat
router.post('/identificar', async (req, res) => {
    try {
        const { nombre, telefono, email, idTenant } = req.body;

        if (!nombre || !telefono) {
            return res.status(400).json({ ok: false, error: 'Nombre y teléfono son obligatorios' });
        }

        const tenantId = idTenant || 1; // Should match req.db.tenantId

        // 1. Buscar si ya existe por teléfono
        const queryBuscar = `
            SELECT id, nombre, telefono 
            FROM clientefinal 
            WHERE id_tenant = $1 AND telefono = $2
            LIMIT 1
        `;
        const resultBuscar = await req.db.query(queryBuscar, [tenantId, telefono]);

        if (resultBuscar.rows.length > 0) {
            // Cliente existe
            return res.json({
                ok: true,
                cliente: resultBuscar.rows[0]
            });
        }

        // 2. Si no existe, crear nuevo
        // Generamos un documento dummy porque es obligatorio en la tabla
        const documentoDummy = `CHAT-${Date.now()}`;

        const queryInsert = `
            INSERT INTO clientefinal (
                id_tenant, nombre, documento, telefono, email, origen_cliente, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, 'WEB_CHAT', NOW()
            )
            RETURNING id, nombre, telefono
        `;

        const resultInsert = await req.db.query(queryInsert, [
            tenantId,
            nombre,
            documentoDummy,
            telefono,
            email || null
        ]);

        res.json({
            ok: true,
            cliente: resultInsert.rows[0]
        });

    } catch (error) {
        console.error('Error en /identificar:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 1.1. Obtener o crear la conversación actual del cliente
router.get('/conversacion-actual', async (req, res) => {
    console.log('Hit /conversacion-actual');
    try {
        const { idTenant, idCliente } = getClientContext(req);

        // Buscar conversación ABIERTA
        const queryBuscar = `
            SELECT *
            FROM chat_conversacion
            WHERE id_tenant = $1
              AND id_cliente = $2
              AND estado = 'ABIERTO'
            ORDER BY updated_at DESC
            LIMIT 1
        `;
        const resultBuscar = await req.db.query(queryBuscar, [idTenant, idCliente]);

        let conversacion;

        if (resultBuscar.rows.length > 0) {
            conversacion = resultBuscar.rows[0];
        } else {
            // Crear nueva
            const queryInsert = `
                INSERT INTO chat_conversacion (
                    id_tenant, id_cliente, canal, estado, ultimo_mensaje_at, created_at, updated_at
                ) VALUES (
                    $1, $2, 'WEB', 'ABIERTO', NOW(), NOW(), NOW()
                )
                RETURNING *
            `;
            const resultInsert = await req.db.query(queryInsert, [idTenant, idCliente]);
            conversacion = resultInsert.rows[0];
        }

        // Obtener mensajes
        const queryMensajes = `
            SELECT id, emisor_tipo as "emisorTipo", texto, tipo_mensaje as "tipoMensaje", url_adjunto as "urlAdjunto", created_at as "createdAt"
            FROM chat_mensaje
            WHERE id_conversacion = $1
            ORDER BY created_at ASC
        `;
        const resultMensajes = await req.db.query(queryMensajes, [conversacion.id]);

        res.json({
            conversacion: {
                id: conversacion.id,
                idTenant: conversacion.id_tenant,
                idCliente: conversacion.id_cliente,
                estado: conversacion.estado,
                canal: conversacion.canal,
                ultimoMensajeAt: conversacion.ultimo_mensaje_at
            },
            mensajes: resultMensajes.rows
        });

    } catch (error) {
        console.error('Error en /conversacion-actual:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 1.2. Enviar mensaje del cliente
router.post('/mensajes', async (req, res) => {
    try {
        const { idTenant, idCliente } = getClientContext(req);
        const { idConversacion, texto, tipoMensaje, urlAdjunto } = req.body;

        if (!idConversacion) {
            return res.status(400).json({ ok: false, error: 'Faltan datos' });
        }

        // Validar que la conversación pertenece al cliente
        const queryValidar = `
            SELECT id FROM chat_conversacion
            WHERE id = $1 AND id_tenant = $2 AND id_cliente = $3
        `;
        const resultValidar = await req.db.query(queryValidar, [idConversacion, idTenant, idCliente]);

        if (resultValidar.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }

        // Insertar mensaje
        const queryInsert = `
            INSERT INTO chat_mensaje (
                id_conversacion, id_usuario, emisor_tipo, texto, tipo_mensaje, url_adjunto, created_at
            ) VALUES (
                $1, NULL, 'CLIENTE', $2, $3, $4, NOW()
            )
            RETURNING id, id_conversacion as "idConversacion", emisor_tipo as "emisorTipo", texto, tipo_mensaje as "tipoMensaje", url_adjunto as "urlAdjunto", created_at as "createdAt"
        `;

        const tipo = tipoMensaje || 'TEXTO';
        const url = urlAdjunto || null;

        const resultInsert = await req.db.query(queryInsert, [idConversacion, texto || '', tipo, url]);
        const mensaje = resultInsert.rows[0];

        // Actualizar conversación
        await req.db.query(`
            UPDATE chat_conversacion
            SET ultimo_mensaje_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [idConversacion]);

        res.json({
            ok: true,
            mensaje
        });

    } catch (error) {
        console.error('Error en POST /mensajes:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// 1.3. Obtener mensajes de una conversación (cliente)
router.get('/conversaciones/:id/mensajes', async (req, res) => {
    try {
        const { idTenant, idCliente } = getClientContext(req);
        const idConversacion = req.params.id;

        // Validar acceso
        const queryValidar = `
            SELECT id, estado FROM chat_conversacion
            WHERE id = $1 AND id_tenant = $2 AND id_cliente = $3
        `;
        const resultValidar = await req.db.query(queryValidar, [idConversacion, idTenant, idCliente]);

        if (resultValidar.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'Conversación no encontrada o no autorizada' });
        }
        const conversacion = resultValidar.rows[0];

        // Obtener mensajes
        const queryMensajes = `
            SELECT id, emisor_tipo as "emisorTipo", texto, tipo_mensaje as "tipoMensaje", url_adjunto as "urlAdjunto", created_at as "createdAt"
            FROM chat_mensaje
            WHERE id_conversacion = $1
            ORDER BY created_at ASC
        `;
        const resultMensajes = await req.db.query(queryMensajes, [idConversacion]);

        res.json({
            conversacion: {
                id: conversacion.id,
                estado: conversacion.estado
            },
            mensajes: resultMensajes.rows
        });

    } catch (error) {
        console.error('Error en GET /conversaciones/:id/mensajes:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
