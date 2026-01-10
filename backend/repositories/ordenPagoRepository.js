const pool = require('../db');

class OrdenPagoRepository {
    /**
     * Verifica si una orden existe por su ID.
     * @param {number} idOrden 
     * @returns {Promise<boolean>}
     */
    async existeOrden(idOrden) {
        const result = await pool.query('SELECT 1 FROM orden WHERE id = $1', [idOrden]);
        return result.rowCount > 0;
    }

    async obtenerDatosOrden(idOrden) {
        const result = await pool.query('SELECT id, id_sucursal FROM orden WHERE id = $1', [idOrden]);
        return result.rows[0];
    }

    /**
     * Obtiene un medio de pago por su ID o por su Código.
     * @param {string|number} identificador 
     * @returns {Promise<object|null>}
     */
    async obtenerMedioPagoPorCodigoOId(identificador) {
        let query;
        let values;

        const esNumero = !isNaN(identificador);

        if (esNumero) {
            query = 'SELECT * FROM mediopago WHERE id = $1';
            values = [identificador];
        } else {
            query = 'SELECT * FROM mediopago WHERE UPPER(codigo) = UPPER($1)';
            values = [identificador];
        }

        const result = await pool.query(query, values);
        return result.rows[0] || null;
    }

    /**
     * Verifica si una caja existe por su ID.
     * @param {number} idCaja 
     * @returns {Promise<boolean>}
     */
    async existeCaja(idCaja) {
        const result = await pool.query('SELECT 1 FROM caja WHERE id = $1', [idCaja]);
        return result.rowCount > 0;
    }

    /**
     * Inserta un nuevo registro en ordenpago.
     * @param {object} pagoData 
     * @param {object} [client] - Cliente de base de datos opcional para transacciones
     * @returns {Promise<object>}
     */
    async insertarPagoOrden(pagoData, client = pool) {
        const { id_orden, id_medio_pago, importe, referencia, id_caja, created_by } = pagoData;

        const query = `
            INSERT INTO ordenpago (
                id_orden, 
                id_medio_pago, 
                importe, 
                referencia, 
                id_caja, 
                created_by,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
        `;

        const values = [id_orden, id_medio_pago, importe, referencia, id_caja, created_by];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    /**
     * Obtiene todos los pagos de una orden.
     * @param {number} idOrden 
     * @returns {Promise<Array>}
     */
    async obtenerPagosPorOrden(idOrden) {
        const query = `
            SELECT op.*, mp.nombre as medio_pago_nombre, mp.codigo as medio_pago_codigo
            FROM ordenpago op
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            WHERE op.id_orden = $1
            ORDER BY op.created_at DESC
        `;
        const result = await pool.query(query, [idOrden]);
        return result.rows;
    }

    /**
     * Elimina un pago de una orden.
     * @param {number} idPago - ID del pago a eliminar
     * @returns {Promise<object>} - Pago eliminado
     */
    async eliminarPago(idPago) {
        const query = `
            DELETE FROM ordenpago 
            WHERE id = $1
            RETURNING *
        `;
        const result = await pool.query(query, [idPago]);
        return result.rows[0];
    }

    /**
     * Obtiene todos los medios de pago disponibles.
     * @returns {Promise<Array>}
     */
    async obtenerTodosMediosPago() {
        const query = 'SELECT * FROM mediopago ORDER BY id ASC';
        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = new OrdenPagoRepository();
