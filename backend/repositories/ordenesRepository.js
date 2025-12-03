const pool = require('../db');

class OrdenesRepository {
    async getEstadoOrdenByCodigoOrId(codigo, id) {
        let query = "SELECT id FROM estadoorden WHERE ";
        const params = [];
        if (id) {
            query += "id = $1";
            params.push(id);
        } else {
            query += "codigo = $1";
            params.push(codigo);
        }
        const result = await pool.query(query, params);
        return result.rows[0];
    }

    async getTipoOrdenByCodigoOrId(codigo, id) {
        let query = "SELECT id FROM tipoorden WHERE ";
        const params = [];
        if (id) {
            query += "id = $1";
            params.push(id);
        } else {
            query += "codigo = $1";
            params.push(codigo);
        }
        const result = await pool.query(query, params);
        return result.rows[0];
    }

    async getMedioPagoByCodigoOrId(codigo, id) {
        let query = "SELECT id FROM mediopago WHERE ";
        const params = [];
        if (id) {
            query += "id = $1";
            params.push(id);
        } else {
            query += "codigo = $1";
            params.push(codigo);
        }
        const result = await pool.query(query, params);
        return result.rows[0];
    }

    async getImpuestoById(id) {
        const result = await pool.query("SELECT id, porcentaje FROM impuesto WHERE id = $1", [id]);
        return result.rows[0];
    }

    async getProductoById(id, id_tenant) {
        const result = await pool.query("SELECT id, id_impuesto, nombre, precio FROM producto WHERE id = $1 AND id_tenant = $2", [id, id_tenant]);
        return result.rows[0];
    }

    async checkSucursal(id, id_tenant) {
        const result = await pool.query("SELECT id FROM sucursal WHERE id = $1 AND id_tenant = $2", [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkCliente(id, id_tenant) {
        const result = await pool.query("SELECT id FROM clientefinal WHERE id = $1 AND id_tenant = $2", [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkVehiculo(id, id_tenant) {
        // Verificamos si el vehículo existe y si su cliente pertenece al tenant (o si el vehículo tiene id_tenant si la tabla lo tuviera)
        // Asumimos la estructura: vehiculo -> cliente -> tenant
        const result = await pool.query(`
            SELECT v.id 
            FROM vehiculo v 
            JOIN clientefinal c ON v.id_cliente = c.id 
            WHERE v.id = $1 AND c.id_tenant = $2
        `, [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkMecanico(id, id_tenant) {
        const result = await pool.query("SELECT id FROM usuario WHERE id = $1 AND id_tenant = $2", [id, id_tenant]);
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
                $11, 0, 0, 0, 
                $12, $12, NOW(), NOW()
            ) RETURNING id
        `;

        const values = [
            id_sucursal, id_cliente, id_vehiculo, id_usuario, id_mecanico,
            id_tipo_orden, id_estado_orden, km, concepto, descripcion,
            comentario_interno, created_by
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
            ) RETURNING id
        `;

        const values = [
            id_orden, id_producto, id_impuesto, tipo_item, descripcion,
            cantidad, precio, descuento, iva, subtotal
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async createOrdenPago(client, pagoData) {
        const {
            id_orden,
            id_medio_pago,
            importe,
            referencia,
            id_caja,
            created_by
        } = pagoData;

        const query = `
            INSERT INTO ordenpago (
                id_orden, id_medio_pago, importe, referencia, id_caja, 
                created_at, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, 
                NOW(), $6
            ) RETURNING id
        `;

        const values = [
            id_orden, id_medio_pago, importe, referencia, id_caja, created_by
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async updateOrdenTotales(client, id_orden, totales) {
        const { total_bruto, total_iva, total_neto } = totales;
        const query = `
            UPDATE orden 
            SET total_bruto = $1, total_iva = $2, total_neto = $3
            WHERE id = $4
        `;
        await client.query(query, [total_bruto, total_iva, total_neto, id_orden]);
    }
}

module.exports = new OrdenesRepository();
