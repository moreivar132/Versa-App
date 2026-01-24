/**
 * VERSA - PASO 5: Portal Cliente
 * Repositorio para operaciones de base de datos del portal cliente
 */

const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb) {
    if (!ctxOrDb) return getTenantDb({}, { allowNoTenant: true });
    if (typeof ctxOrDb.query === 'function') return ctxOrDb;
    return getTenantDb(ctxOrDb);
}

class CustomerRepository {

    // =============================================
    // AUTH METHODS
    // =============================================

    /**
     * Buscar auth por email
     */
    async findAuthByEmail(email, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT ca.*, cf.nombre, cf.telefono as cliente_telefono
             FROM clientefinal_auth ca
             JOIN clientefinal cf ON cf.id = ca.id_cliente
             WHERE LOWER(ca.email) = LOWER($1)`,
            [email]
        );
        return result.rows[0] || null;
    }

    /**
     * Buscar auth por id_cliente
     */
    async findAuthByClienteId(idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT ca.*, cf.nombre
             FROM clientefinal_auth ca
             JOIN clientefinal cf ON cf.id = ca.id_cliente
             WHERE ca.id_cliente = $1`,
            [idCliente]
        );
        return result.rows[0] || null;
    }

    /**
     * Buscar clientefinal por email
     */
    async findClienteByEmail(email, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT * FROM clientefinal WHERE LOWER(email) = LOWER($1)`,
            [email]
        );
        return result.rows[0] || null;
    }

    /**
     * Buscar clientefinal por teléfono
     */
    async findClienteByTelefono(telefono, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        // Normalizar teléfono (quitar espacios y caracteres especiales)
        const normalizedPhone = telefono.replace(/\D/g, '');
        const result = await db.query(
            `SELECT * FROM clientefinal WHERE REPLACE(REPLACE(telefono, ' ', ''), '-', '') = $1`,
            [normalizedPhone]
        );
        return result.rows[0] || null;
    }

    /**
     * Crear cliente y auth en una transacción
     */
    async createClienteWithAuth(clienteData, authData, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const shouldManageTransaction = !ctxOrDb || (ctxOrDb && !ctxOrDb.query);

        if (shouldManageTransaction) {
            return db.txWithRLS(async (tx) => {
                const clienteResult = await tx.query(
                    `INSERT INTO clientefinal (nombre, email, telefono, id_tenant)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [clienteData.nombre, clienteData.email, clienteData.telefono || null, clienteData.id_tenant || 1]
                );
                const cliente = clienteResult.rows[0];

                const authResult = await tx.query(
                    `INSERT INTO clientefinal_auth (id_cliente, email, telefono, password_hash)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [cliente.id, authData.email, authData.telefono || null, authData.password_hash]
                );
                const auth = authResult.rows[0];
                return { cliente, auth };
            });
        }

        try {
            const clienteResult = await db.query(
                `INSERT INTO clientefinal (nombre, email, telefono, id_tenant)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [clienteData.nombre, clienteData.email, clienteData.telefono || null, clienteData.id_tenant || 1]
            );
            const cliente = clienteResult.rows[0];

            const authResult = await db.query(
                `INSERT INTO clientefinal_auth (id_cliente, email, telefono, password_hash)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [cliente.id, authData.email, authData.telefono || null, authData.password_hash]
            );
            const auth = authResult.rows[0];
            return { cliente, auth };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Crear auth para cliente existente
     */
    async createAuthForCliente(idCliente, authData, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `INSERT INTO clientefinal_auth (id_cliente, email, telefono, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [idCliente, authData.email, authData.telefono || null, authData.password_hash]
        );
        return result.rows[0];
    }

    /**
     * Actualizar último login
     */
    async updateLastLogin(authId, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        await db.query(
            `UPDATE clientefinal_auth SET last_login_at = NOW() WHERE id = $1`,
            [authId]
        );
    }

    /**
     * Guardar token de reset password
     */
    async saveResetToken(authId, token, expiresAt, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        await db.query(
            `UPDATE clientefinal_auth 
             SET reset_token = $1, reset_token_expires_at = $2 
             WHERE id = $3`,
            [token, expiresAt, authId]
        );
    }

    /**
     * Buscar por token de reset
     */
    async findByResetToken(token, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT ca.*, cf.nombre
             FROM clientefinal_auth ca
             JOIN clientefinal cf ON cf.id = ca.id_cliente
             WHERE ca.reset_token = $1 AND ca.reset_token_expires_at > NOW()`,
            [token]
        );
        return result.rows[0] || null;
    }

    /**
     * Actualizar password y limpiar token de reset
     */
    async updatePassword(authId, passwordHash, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        await db.query(
            `UPDATE clientefinal_auth 
             SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL 
             WHERE id = $2`,
            [passwordHash, authId]
        );
    }

    // =============================================
    // PORTAL METHODS
    // =============================================

    /**
     * Obtener perfil completo del cliente
     */
    async getClienteProfile(idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT cf.*, ca.email as auth_email, ca.email_verified, ca.last_login_at
             FROM clientefinal cf
             LEFT JOIN clientefinal_auth ca ON ca.id_cliente = cf.id
             WHERE cf.id = $1`,
            [idCliente]
        );
        return result.rows[0] || null;
    }

    /**
     * Actualizar perfil del cliente
     */
    async updateClienteProfile(idCliente, data, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (data.nombre !== undefined) {
            updates.push(`nombre = $${paramIndex++}`);
            values.push(data.nombre);
        }
        if (data.telefono !== undefined) {
            updates.push(`telefono = $${paramIndex++}`);
            values.push(data.telefono);
        }
        if (data.direccion !== undefined) {
            updates.push(`direccion = $${paramIndex++}`);
            values.push(data.direccion);
        }

        if (updates.length === 0) {
            return this.getClienteProfile(idCliente);
        }

        values.push(idCliente);

        const result = await db.query(
            `UPDATE clientefinal SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0];
    }

    /**
     * Obtener citas del cliente
     */
    async getClienteCitas(idCliente, scope = 'all', ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        let whereClause = 'c.id_cliente = $1';
        const now = new Date().toISOString();

        if (scope === 'upcoming') {
            whereClause += ` AND c.fecha_hora >= '${now}'`;
        } else if (scope === 'past') {
            whereClause += ` AND c.fecha_hora < '${now}'`;
        }

        try {
            const result = await db.query(
                `SELECT DISTINCT ON (c.id)
                c.id,
                c.fecha_hora,
                c.estado,
                c.motivo,
                c.notas,
                c.created_at,
                s.id as id_sucursal,
                s.nombre as sucursal_nombre,
                s.direccion as sucursal_direccion,
                mrp.status as pago_status,
                mrp.checkout_url as pago_url,
                mrp.amount as pago_amount
             FROM citataller c
             JOIN sucursal s ON s.id = c.id_sucursal
             LEFT JOIN marketplace_reserva_pago mrp ON mrp.id_cita = c.id AND mrp.status IN ('PENDING', 'PAID')
             WHERE ${whereClause}
             ORDER BY c.id, mrp.created_at DESC NULLS LAST`,
                [idCliente]
            );

            // Ordenar por fecha_hora en JavaScript ya que DISTINCT ON no permite otro ORDER BY
            const sortedRows = result.rows.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

            // Map result to match expected frontend structure
            return sortedRows.map(row => ({
                id: row.id,
                fecha_hora: row.fecha_hora,
                estado: row.estado,
                duracion_estimada: 60, // Default
                motivo: row.motivo,
                servicio: { nombre: row.motivo },
                sucursal: {
                    id: row.id_sucursal,
                    nombre: row.sucursal_nombre,
                    direccion: row.sucursal_direccion,
                    telefono: null
                },
                vehiculo: null, // Temporarily removed vehicle join
                // Campos de pago
                pago_status: row.pago_status,
                pago_url: row.pago_url,
                pago_amount: row.pago_amount
            }));
        } catch (err) {
            console.error('Error SQL getClienteCitas:', err);
            throw err;
        }
    }

    /**
     * Obtener una cita específica del cliente
     */
    async getClienteCitaById(idCliente, idCita, ctxOrDb = null) {
        try {
            const db = resolveDb(ctxOrDb);
            const result = await db.query(
                `SELECT 
                    c.*,
                    s.nombre as sucursal_nombre,
                    s.direccion as sucursal_direccion
                 FROM citataller c
                 JOIN sucursal s ON s.id = c.id_sucursal
                 WHERE c.id = $1 AND c.id_cliente = $2`,
                [idCita, idCliente]
            );
            return result.rows[0] || null;
        } catch (err) {
            console.error('Error SQL getClienteCitaById:', err);
            return null;
        }
    }

    /**
     * Cancelar cita
     */
    async cancelarCita(idCita, idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `UPDATE citataller 
             SET estado = 'cancelada' 
             WHERE id = $1 AND id_cliente = $2
             RETURNING *`,
            [idCita, idCliente]
        );
        return result.rows[0] || null;
    }

    /**
     * Reprogramar cita
     */
    async reprogramarCita(idCita, idCliente, nuevaFechaHora, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `UPDATE citataller 
             SET fecha_hora = $1, estado = 'pendiente'
             WHERE id = $2 AND id_cliente = $3
             RETURNING *`,
            [nuevaFechaHora, idCita, idCliente]
        );
        return result.rows[0] || null;
    }

    /**
     * Obtener pagos del cliente
     */
    async getClientePagos(idCliente, ctxOrDb = null) {
        try {
            const db = resolveDb(ctxOrDb);
            const result = await db.query(
                `SELECT 
                    'pago_cita' as tipo,
                    p.id,
                    p.created_at as fecha,
                    COALESCE(c.motivo, 'Reserva de Cita') as concepto,
                    p.amount as importe,
                    p.status,
                    p.payment_mode
                 FROM marketplace_reserva_pago p
                 LEFT JOIN citataller c ON c.id = p.id_cita
                 WHERE p.id_cliente = $1
                 ORDER BY p.created_at DESC`,
                [idCliente]
            );
            return result.rows;
        } catch (err) {
            console.error('Error SQL getClientePagos:', err);
            return [];
        }
    }

    /**
     * Crear reseña para una cita (en tabla marketplace_review)
     */
    async createResena(idCita, puntuacion, comentario, fotos = [], ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        // 1. Obtener datos necesarios de la cita (tenant, sucursal, cliente)
        const citaData = await db.query(
            `SELECT s.id_tenant, c.id_sucursal, c.id_cliente, c.estado
             FROM citataller c
             JOIN sucursal s ON s.id = c.id_sucursal
             WHERE c.id = $1`,
            [idCita]
        );

        if (citaData.rows.length === 0) {
            throw new Error('Cita no encontrada para crear reseña');
        }

        const { id_tenant, id_sucursal, id_cliente, estado } = citaData.rows[0];

        // Verificar que la cita esté completada
        if (!['completada', 'completado'].includes(estado)) {
            throw { status: 400, message: 'Solo puedes dejar reseña en citas completadas' };
        }

        // 2. Insertar en marketplace_review con fotos
        const result = await db.query(
            `INSERT INTO marketplace_review 
                (id_tenant, id_sucursal, id_cliente, id_cita, rating, comentario, fotos_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [id_tenant, id_sucursal, id_cliente, idCita, puntuacion, comentario, JSON.stringify(fotos)]
        );
        return result.rows[0];
    }

    /**
     * Obtener reseña de una cita por cliente
     */
    async getResenaPorCita(idCliente, idCita, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT r.*, c.fecha_hora as cita_fecha, s.nombre as sucursal_nombre
             FROM marketplace_review r
             JOIN citataller c ON c.id = r.id_cita
             JOIN sucursal s ON s.id = r.id_sucursal
             WHERE r.id_cita = $1 AND r.id_cliente = $2`,
            [idCita, idCliente]
        );
        return result.rows[0] || null;
    }

    /**
     * Actualizar reseña de una cita
     */
    async updateResena(idCliente, idCita, data, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (data.puntuacion !== undefined) {
            updates.push(`rating = $${paramIndex++}`);
            values.push(data.puntuacion);
        }
        if (data.comentario !== undefined) {
            updates.push(`comentario = $${paramIndex++}`);
            values.push(data.comentario);
        }
        if (data.fotos !== undefined) {
            updates.push(`fotos_json = $${paramIndex++}`);
            values.push(JSON.stringify(data.fotos));
        }

        if (updates.length === 0) {
            return this.getResenaPorCita(idCliente, idCita);
        }

        values.push(idCita, idCliente);

        const result = await db.query(
            `UPDATE marketplace_review 
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id_cita = $${paramIndex++} AND id_cliente = $${paramIndex}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            throw { status: 404, message: 'Reseña no encontrada' };
        }

        return result.rows[0];
    }

    /**
     * Eliminar reseña de una cita
     */
    async deleteResena(idCliente, idCita, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `DELETE FROM marketplace_review 
             WHERE id_cita = $1 AND id_cliente = $2
             RETURNING id`,
            [idCita, idCliente]
        );

        if (result.rows.length === 0) {
            throw { status: 404, message: 'Reseña no encontrada' };
        }

        return true;
    }

    /**
     * Verificar si slot está disponible
     */
    async checkSlotDisponible(idSucursal, fechaHora, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT COUNT(*) as count FROM citataller 
             WHERE id_sucursal = $1 
             AND fecha_hora = $2 
             AND estado NOT IN ('cancelada', 'no_asistio')`,
            [idSucursal, fechaHora]
        );
        return parseInt(result.rows[0].count) === 0;
    }

    /**
     * Obtener todas las reseñas del cliente
     */
    async getAllResenasCliente(idCliente, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const result = await db.query(
            `SELECT 
                r.id,
                r.id_cita,
                r.rating,
                r.comentario,
                r.fotos_json,
                r.created_at,
                r.updated_at,
                s.nombre as sucursal_nombre,
                s.direccion as sucursal_direccion,
                c.fecha_hora as cita_fecha
             FROM marketplace_review r
             JOIN sucursal s ON s.id = r.id_sucursal
             LEFT JOIN citataller c ON c.id = r.id_cita
             WHERE r.id_cliente = $1
             ORDER BY r.created_at DESC`,
            [idCliente]
        );
        return result.rows;
    }
}

module.exports = new CustomerRepository();
