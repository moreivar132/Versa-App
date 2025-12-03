const pool = require('../db');

const getExecutor = (client) => client || pool;

class OrdenesRepository {
    async getEstadoOrdenByCodigoOrId({ codigo, id }, client) {
        const executor = getExecutor(client);
        const params = [];
        let query = 'SELECT id FROM estadoorden WHERE ';
        if (id) {
            query += 'id = $1';
            params.push(id);
        } else {
            query += 'codigo = $1';
            params.push(codigo);
        }
        const result = await executor.query(query, params);
        return result.rows[0];
    }

    async getTipoOrdenByCodigoOrId({ codigo, id }, client) {
        const executor = getExecutor(client);
        const params = [];
        let query = 'SELECT id FROM tipoorden WHERE ';
        if (id) {
            query += 'id = $1';
            params.push(id);
        } else {
            query += 'codigo = $1';
            params.push(codigo);
        }
        const result = await executor.query(query, params);
        return result.rows[0];
    }

    async getMedioPagoByCodigoOrId({ codigo, id }, client) {
        const executor = getExecutor(client);
        const params = [];
        let query = 'SELECT id FROM mediopago WHERE ';
        if (id) {
            query += 'id = $1';
            params.push(id);
        } else {
            query += 'codigo = $1';
            params.push(codigo);
        }
        const result = await executor.query(query, params);
        return result.rows[0];
    }

    async getImpuestoById(id, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id, porcentaje FROM impuesto WHERE id = $1', [id]);
        return result.rows[0];
    }

    async getProductoById(id, id_tenant, client) {
        const executor = getExecutor(client);
        const result = await executor.query(
            'SELECT id, id_impuesto, nombre, precio FROM producto WHERE id = $1 AND id_tenant = $2',
            [id, id_tenant]
        );
        return result.rows[0];
    }

    async checkSucursal(id, id_tenant, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM sucursal WHERE id = $1 AND id_tenant = $2', [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkCliente(id, id_tenant, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM clientefinal WHERE id = $1 AND id_tenant = $2', [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkVehiculo(id, id_tenant, client) {
        const executor = getExecutor(client);
        const result = await executor.query(
            `
            SELECT v.id
            FROM vehiculo v
            JOIN clientefinal c ON v.id_cliente = c.id
            WHERE v.id = $1 AND c.id_tenant = $2
        `,
            [id, id_tenant]
        );
        return result.rows.length > 0;
    }

    async checkMecanico(id, id_tenant, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM usuario WHERE id = $1 AND id_tenant = $2', [id, id_tenant]);
        return result.rows.length > 0;
    }

    async createOrden(client, ordenData) {
        const {
            id_sucursal,
            id_cliente,
            id_vehiculo,
            id_usuario,
            id_mecanico,
            id_tipo_orden,
            id_estado_orden,
            km,
            concepto,
            descripcion,
            comentario_interno,
            total_bruto,
            total_iva,
            total_neto,
            created_by
        } = ordenData;

        const query = `
            INSERT INTO orden (
                id_sucursal, id_cliente, id_vehiculo, id_usuario, id_mecanico,
                id_tipo_orden, id_estado_orden, km, concepto, descripcion,
                comentario_interno, total_bruto, total_iva, total_neto,
                created_by, updated_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14,
                $15, $15, NOW(), NOW()
            ) RETURNING id, id_sucursal, id_cliente, id_vehiculo, id_usuario, id_mecanico, id_tipo_orden,
                     id_estado_orden, km, concepto, descripcion, comentario_interno, total_bruto, total_iva, total_neto
        `;

        const values = [
            id_sucursal,
            id_cliente,
            id_vehiculo,
            id_usuario,
            id_mecanico,
            id_tipo_orden,
            id_estado_orden,
            km,
            concepto,
            descripcion,
            comentario_interno,
            total_bruto,
            total_iva,
            total_neto,
            created_by
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async createOrdenLinea(client, lineaData) {
        const {
            id_orden,
            id_producto,
            id_impuesto,
            tipo_item,
            descripcion,
            cantidad,
            precio,
            descuento,
            iva,
            subtotal
        } = lineaData;

        const query = `
            INSERT INTO ordenlinea (
                id_orden, id_producto, id_impuesto, tipo_item, descripcion,
                cantidad, precio, descuento, iva, subtotal,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                NOW(), NOW()
            ) RETURNING id, id_orden, id_producto, id_impuesto, tipo_item, descripcion, cantidad, precio, descuento, iva, subtotal
        `;

        const values = [
            id_orden,
            id_producto,
            id_impuesto,
            tipo_item,
            descripcion,
            cantidad,
            precio,
            descuento,
            iva,
            subtotal
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async createOrdenPago(client, pagoData) {
        const { id_orden, id_medio_pago, importe, referencia, id_caja, created_by } = pagoData;

        const query = `
            INSERT INTO ordenpago (
                id_orden, id_medio_pago, importe, referencia, id_caja,
                created_at, created_by
            ) VALUES (
                $1, $2, $3, $4, $5,
                NOW(), $6
            ) RETURNING id, id_orden, id_medio_pago, importe, referencia, id_caja
        `;

        const values = [id_orden, id_medio_pago, importe, referencia, id_caja, created_by];

        const result = await client.query(query, values);
        return result.rows[0];
    }
}

module.exports = new OrdenesRepository();
