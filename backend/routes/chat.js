const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware para obtener el tenant y cliente (simulado o real según auth)
// En un caso real, esto vendría del token JWT decodificado.
// Aquí asumiremos que se pasan o se infieren. 
// Para el cliente web, a veces es una sesión anónima o un login de cliente.
// EL PROMPT DICE: "Supón que ya sabes en backend quién es el cliente (ej: id_cliente e id_tenant vienen del token/sesión)."
// Vamos a simular un middleware que extrae esto, o asumiremos que el frontend lo envía en headers/body si no hay auth completa implementada para clientes finales.
// Dado el contexto del proyecto, voy a asumir que req.user o similar tiene la info, o lo sacamos de headers para facilitar la prueba si no hay auth de cliente final estricta.
// PERO, para ser seguros, vamos a usar un middleware dummy o esperar que venga en el request si no hay auth.
// REVISANDO CÓDIGO EXISTENTE: parece que hay 'verifyJWT' en index.js pero es para usuarios del CRM (admin/trabajador).
// Para el CLIENTE FINAL (portal), no he visto auth.
// Voy a asumir que el frontend envía `x-tenant-id` y `x-client-id` por ahora para simplificar, o que hay un middleware que lo pone.
// MEJOR: Voy a esperar que vengan en el body o query para "conversacion-actual" si no hay auth.
// OJO: El prompt dice "Supón que ya sabes en backend quién es el cliente".
// Voy a implementar un helper para sacar estos IDs.

const getClientContext = (req) => {
    // ESTO ES UNA SIMULACIÓN. En prod vendría del token.
    // Permitimos enviarlos por headers para probar.
    const idTenant = req.headers['x-tenant-id'] || 1; // Default a 1 si no viene
    const idCliente = req.headers['x-client-id'] || 1; // Default a 1 si no viene
    return { idTenant, idCliente };
};

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
        const resultBuscar = await pool.query(queryBuscar, [idTenant, idCliente]);

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
            const resultInsert = await pool.query(queryInsert, [idTenant, idCliente]);
            conversacion = resultInsert.rows[0];
        }

        // Obtener mensajes
        const queryMensajes = `
            SELECT id, emisor_tipo as "emisorTipo", texto, tipo_mensaje as "tipoMensaje", url_adjunto as "urlAdjunto", created_at as "createdAt"
            FROM chat_mensaje
            WHERE id_conversacion = $1
            ORDER BY created_at ASC
        `;
        const resultMensajes = await pool.query(queryMensajes, [conversacion.id]);

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
        const resultValidar = await pool.query(queryValidar, [idConversacion, idTenant, idCliente]);

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

        const resultInsert = await pool.query(queryInsert, [idConversacion, texto || '', tipo, url]);
        const mensaje = resultInsert.rows[0];

        // Actualizar conversación
        await pool.query(`
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
        const resultValidar = await pool.query(queryValidar, [idConversacion, idTenant, idCliente]);

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
        const resultMensajes = await pool.query(queryMensajes, [idConversacion]);

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
