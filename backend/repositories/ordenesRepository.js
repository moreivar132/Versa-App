const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb) {
    if (!ctxOrDb) return getTenantDb({}, { allowNoTenant: true });
    if (typeof ctxOrDb.query === 'function') return ctxOrDb;
    return getTenantDb(ctxOrDb);
}

const getExecutor = resolveDb;

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
        let query = 'SELECT * FROM mediopago WHERE ';
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
            'SELECT id, id_impuesto, nombre, precio, COALESCE(stock, 0) AS stock FROM producto WHERE id = $1 AND id_tenant = $2',
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

    // Métodos para verificar SOLO existencia (sin tenant) - Para Super Admins
    async checkSucursalExists(id, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM sucursal WHERE id = $1', [id]);
        return result.rows.length > 0;
    }

    async checkClienteExists(id, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM clientefinal WHERE id = $1', [id]);
        return result.rows.length > 0;
    }

    async checkVehiculoExists(id, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM vehiculo WHERE id = $1', [id]);
        return result.rows.length > 0;
    }

    async checkMecanicoExists(id, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM usuario WHERE id = $1', [id]);
        return result.rows.length > 0;
    }

    async createOrden(client, ordenData) {
        const db = resolveDb(client);
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
            total_bruto = 0,
            total_iva = 0,
            total_neto = 0,
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

        const result = await db.query(query, values);
        return result.rows[0];
    }

    async createOrdenLinea(client, lineaData) {
        const db = resolveDb(client);
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

        const result = await db.query(query, values);
        return result.rows[0];
    }

    async createOrdenPago(client, pagoData) {
        const db = resolveDb(client);
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

        const result = await db.query(query, values);
        return result.rows[0];
    }
    async updateOrdenTotales(client, idOrden, totals) {
        const db = resolveDb(client);
        const { total_bruto, total_iva, total_neto } = totals;
        const query = `
            UPDATE orden
            SET total_bruto = $1, total_iva = $2, total_neto = $3, updated_at = NOW()
            WHERE id = $4
        `;
        await db.query(query, [total_bruto, total_iva, total_neto, idOrden]);
    }

    async decreaseProductoStock(client, idProducto, cantidad) {
        const db = resolveDb(client);
        const query = `
            UPDATE producto
            SET stock = COALESCE(stock, 0) - $1, updated_at = NOW()
            WHERE id = $2 AND COALESCE(stock, 0) >= $1
            RETURNING stock
        `;
        const result = await db.query(query, [cantidad, idProducto]);

        if (result.rowCount === 0) {
            throw new Error('Stock insuficiente para el producto seleccionado');
        }
    }

    async ensureAlmacenPrincipal(idSucursal, client) {
        const executor = getExecutor(client);
        const result = await executor.query('SELECT id FROM almacen WHERE id_sucursal = $1 ORDER BY id ASC LIMIT 1', [idSucursal]);
        if (result.rows.length > 0) {
            return result.rows[0].id;
        }

        // Create default if not exists
        const createResult = await executor.query(
            'INSERT INTO almacen (id_sucursal, nombre, created_at) VALUES ($1, $2, NOW()) RETURNING id',
            [idSucursal, 'Almacén Principal']
        );
        return createResult.rows[0].id;
    }

    async createMovimientoInventario(client, data) {
        const db = resolveDb(client);
        const { id_producto, id_almacen, tipo, cantidad, origen_tipo, origen_id, created_by } = data;
        const query = `
            INSERT INTO movimientoinventario
            (id_producto, id_almacen, tipo, cantidad, origen_tipo, origen_id, created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
        `;
        await db.query(query, [id_producto, id_almacen, tipo, cantidad, origen_tipo, origen_id, created_by]);
    }

    /**
     * Crea un movimiento de caja (ingreso/egreso)
     * @param {object} client - Cliente de transacción
     * @param {object} data - Datos del movimiento
     */
    async createCajaMovimiento(client, data) {
        const db = resolveDb(client);
        const { id_caja, id_usuario, tipo, monto, origen_tipo, origen_id, created_by } = data;
        const query = `
            INSERT INTO cajamovimiento
            (id_caja, id_usuario, tipo, monto, fecha, origen_tipo, origen_id, created_at, created_by)
            VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW(), $7)
            RETURNING id
        `;
        const result = await db.query(query, [id_caja, id_usuario, tipo, monto, origen_tipo, origen_id, created_by]);
        return result.rows[0];
    }

    async getOpenCaja(client, idSucursal) {
        const db = resolveDb(client);
        const query = `
            SELECT * FROM caja 
            WHERE id_sucursal = $1 AND estado = 'ABIERTA' 
            ORDER BY created_at DESC LIMIT 1
        `;
        const result = await db.query(query, [idSucursal]);
        return result.rows[0];
    }

    async createOpenCaja(client, idSucursal, idUsuario) {
        const db = resolveDb(client);
        const query = `
            INSERT INTO caja (id_sucursal, nombre, estado, id_usuario_apertura, created_by, created_at, updated_at) 
            VALUES ($1, 'Caja Principal', 'ABIERTA', $2, $2, NOW(), NOW()) 
            RETURNING *
        `;
        const result = await db.query(query, [idSucursal, idUsuario]);
        return result.rows[0];
    }

    async createTipoOrden(codigo, nombre, ctxOrDb = null) {
        const db = resolveDb(ctxOrDb);
        const query = 'INSERT INTO tipoorden (codigo, nombre) VALUES ($1, $2) RETURNING id, codigo, nombre';
        const result = await db.query(query, [codigo, nombre]);
        return result.rows[0];
    }
}

module.exports = new OrdenesRepository();
