/**
 * VERSA - Servicio de Notificaciones para Clientes
 * Maneja la creación y consulta de notificaciones del portal cliente
 */

const { getTenantDb } = require('../src/core/db/tenant-db');

/**
 * Helper to resolve DB connection from context or DB client
 */
function resolveDb(ctxOrDb) {
    if (!ctxOrDb) return null;
    if (ctxOrDb.query && typeof ctxOrDb.query === 'function') return ctxOrDb; // It's a DB client/req.db
    return getTenantDb(ctxOrDb); // It's a context
}

class NotificacionService {

    /**
     * Crear notificación para un cliente
     */
    async crearNotificacion(idCliente, tipo, titulo, mensaje, data = {}, ctxOrDb = null) {
        try {
            const db = resolveDb(ctxOrDb);
            if (!db) {
                console.warn('[NotificacionService] No DB/Context provided for crearNotificacion');
                return null;
            }

            const result = await db.query(`
                INSERT INTO cliente_notificacion (id_cliente, tipo, titulo, mensaje, data)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, created_at
            `, [idCliente, tipo, titulo, mensaje, JSON.stringify(data)]);

            return result.rows[0];
        } catch (error) {
            console.error('Error al crear notificación:', error);
            // No lanzar error, las notificaciones no deben interrumpir el flujo principal
            return null;
        }
    }

    /**
     * Obtener notificaciones de un cliente
     */
    async getNotificaciones(idCliente, soloNoLeidas = false, limit = 20, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        if (!db) return [];

        let query = `
            SELECT id, tipo, titulo, mensaje, leida, data, created_at
            FROM cliente_notificacion
            WHERE id_cliente = $1
        `;

        if (soloNoLeidas) {
            query += ` AND leida = FALSE`;
        }

        query += ` ORDER BY created_at DESC LIMIT $2`;

        const result = await db.query(query, [idCliente, limit]);
        return result.rows;
    }

    /**
     * Contar notificaciones no leídas
     */
    async contarNoLeidas(idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        if (!db) return 0;

        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM cliente_notificacion
            WHERE id_cliente = $1 AND leida = FALSE
        `, [idCliente]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Marcar notificación como leída
     */
    async marcarLeida(idNotificacion, idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        if (!db) return;

        await db.query(`
            UPDATE cliente_notificacion
            SET leida = TRUE
            WHERE id = $1 AND id_cliente = $2
        `, [idNotificacion, idCliente]);
    }

    /**
     * Marcar todas como leídas
     */
    async marcarTodasLeidas(idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        if (!db) return;

        await db.query(`
            UPDATE cliente_notificacion
            SET leida = TRUE
            WHERE id_cliente = $1 AND leida = FALSE
        `, [idCliente]);
    }

    /**
     * Notificar cambio de estado de cita
     */
    async notificarCambioEstadoCita(idCita, estadoAnterior, estadoNuevo, ctxOrDb = null) {
        try {
            const db = resolveDb(ctxOrDb);
            if (!db) return null;

            // Obtener datos de la cita y cliente
            const citaResult = await db.query(`
                SELECT c.id, c.id_cliente, c.fecha_hora, c.motivo, 
                       s.nombre as sucursal_nombre,
                       cli.nombre as cliente_nombre
                FROM citataller c
                LEFT JOIN sucursal s ON c.id_sucursal = s.id
                LEFT JOIN clientefinal cli ON c.id_cliente = cli.id
                WHERE c.id = $1
            `, [idCita]);

            if (citaResult.rows.length === 0) {
                return null;
            }

            const cita = citaResult.rows[0];

            // No crear notificación si no hay cliente asociado
            if (!cita.id_cliente) {
                return null;
            }

            // Generar título y mensaje según el estado
            const estadoLabels = {
                pendiente: 'Pendiente',
                confirmada: 'Confirmada',
                en_progreso: 'En Progreso',
                completada: 'Completada',
                cancelada: 'Cancelada',
                no_asistio: 'No Asistió'
            };

            const estadoLabel = estadoLabels[estadoNuevo] || estadoNuevo;
            const fecha = new Date(cita.fecha_hora).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });

            let titulo = '';
            let mensaje = '';
            let tipo = 'cita_actualizada';

            switch (estadoNuevo) {
                case 'confirmada':
                    titulo = '✅ Cita Confirmada';
                    mensaje = `Tu cita del ${fecha} ha sido confirmada por el taller.`;
                    tipo = 'cita_confirmada';
                    break;
                case 'en_progreso':
                    titulo = '🔧 Tu vehículo está en el taller';
                    mensaje = `Han comenzado a trabajar en tu cita del ${fecha}.`;
                    tipo = 'cita_en_progreso';
                    break;
                case 'completada':
                    titulo = '✅ Servicio Completado';
                    mensaje = `El servicio de tu cita del ${fecha} ha sido completado. ¡Gracias por confiar en nosotros!`;
                    tipo = 'cita_completada';
                    break;
                case 'cancelada':
                    titulo = '❌ Cita Cancelada';
                    mensaje = `Tu cita del ${fecha} ha sido cancelada por el taller. Contacta con ellos para más información.`;
                    tipo = 'cita_cancelada';
                    break;
                default:
                    titulo = '📋 Actualización de Cita';
                    mensaje = `El estado de tu cita del ${fecha} ha cambiado a "${estadoLabel}".`;
            }

            return await this.crearNotificacion(cita.id_cliente, tipo, titulo, mensaje, {
                id_cita: idCita,
                estado_anterior: estadoAnterior,
                estado_nuevo: estadoNuevo,
                sucursal: cita.sucursal_nombre,
                motivo: cita.motivo
            }, db);

        } catch (error) {
            console.error('Error al notificar cambio de estado:', error);
            return null;
        }
    }
}

module.exports = new NotificacionService();
