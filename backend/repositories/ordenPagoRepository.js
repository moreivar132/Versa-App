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

    /**
     * Obtiene un medio de pago por su ID o por su Código.
     * @param {string|number} identificador 
     * @returns {Promise<object|null>}
     */
    async obtenerMedioPagoPorCodigoOId(identificador) {
        let query;
        let values;

        // Si es un número, buscamos por ID. Si es string, por código.
        // Nota: A veces el input puede venir como string numérico ("1"), 
        // así que intentamos parsearlo o chequear si es numérico.
        const esNumero = !isNaN(identificador);

        if (esNumero) {
            query = 'SELECT * FROM mediopago WHERE id = $1';
            values = [identificador];
        } else {
            // Asumimos que si no es número, es el código (ej: 'EFECTIVO')
            // Usamos UPPER para asegurar coincidencia si la tabla usa mayúsculas
            query = 'SELECT * FROM mediopago WHERE UPPER(codigo) = UPPER($1)';
            values = [identificador];
        }

        const result = await pool.query(query, values);

        // Si no se encontró por ID y era un número, podría ser que el código sea un número (raro pero posible)
        // O si se pasó un string que parece número pero era código. 
        // Por ahora mantenemos la lógica simple: numero -> id, texto -> codigo.

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
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

        const values = [id_orden, id_medio_pago, importe, referencia, id_caja, created_by];

        const result = await client.query(query, values);
        return result.rows[0];
    }
}

module.exports = new OrdenPagoRepository();
