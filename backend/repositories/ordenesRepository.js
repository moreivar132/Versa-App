const pool = require('../db');

class OrdenesRepository {
    async getEstadoAbierta() {
        const result = await pool.query("SELECT id FROM estadoorden WHERE nombre = 'ABIERTA' LIMIT 1");
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
        // Vehiculo might not have id_tenant directly if it's linked to client, but usually it does or we check via client.
        // Assuming vehiculo has id_tenant based on context (or we check via client ownership).
        // Let's check the schema if possible. The user said "vehículo pertenece al tenant".
        // I'll assume it has id_tenant or I check if the client it belongs to belongs to the tenant.
        // For now, I'll assume it has id_tenant or I'll check if the client matches.
        // But wait, the user said "vehículo pertenece al tenant (y si aplica, vinculado al cliente)".
        // I'll check if the vehicle exists. If the vehicle table has id_tenant, I use it.
        // If not, I might skip tenant check for vehicle if I can't verify it easily without schema.
        // However, `backend/routes/citas.js` inserts vehicle with `id_sucursal` (which implies tenant via sucursal) but not `id_tenant` directly in the INSERT.
        // Wait, `INSERT INTO vehiculo (id_cliente, id_sucursal, ...)`
        // So vehicle is linked to client. Client is linked to tenant.
        // So I should check if the vehicle's client belongs to the tenant.
        const result = await pool.query(`
      SELECT v.id 
      FROM vehiculo v 
      JOIN clientefinal c ON v.id_cliente = c.id 
      WHERE v.id = $1 AND c.id_tenant = $2
    `, [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkMecanico(id, id_tenant) {
        // Mecanico is a user. Users might not have id_tenant directly if they are global, but usually they do.
        // `usuario` table.
        const result = await pool.query("SELECT id FROM usuario WHERE id = $1 AND id_tenant = $2", [id, id_tenant]);
        return result.rows.length > 0;
    }

    async checkTipoOrden(id) {
        const result = await pool.query("SELECT id FROM tipoorden WHERE id = $1", [id]);
        return result.rows.length > 0;
    }

    async checkProducto(id, id_tenant) {
        // Assuming `producto` table has `id_tenant`.
        const result = await pool.query("SELECT id FROM producto WHERE id = $1 AND id_tenant = $2", [id, id_tenant]);
        return result.rows.length > 0;
    }

    async createOrden(client, ordenData) {
        const {
            id_tenant,
            id_sucursal,
            id_cliente,
            id_vehiculo,
            id_mecanico,
            id_tipoorden,
            id_estadoorden,
            km,
            concepto,
            descripcion,
            comentario_interno,
            creado_por
        } = ordenData;

        const query = `
      INSERT INTO orden (
        id_tenant, id_sucursal, id_cliente, id_vehiculo, id_mecanico, 
        id_tipoorden, id_estadoorden, km, concepto, descripcion, 
        comentario_interno, total_bruto, total_iva, total_neto, creado_por, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10, 
        $11, 0, 0, 0, $12, NOW()
      ) RETURNING id
    `;

        const values = [
            id_tenant, id_sucursal, id_cliente, id_vehiculo, id_mecanico,
            id_tipoorden, id_estadoorden, km, concepto, descripcion,
            comentario_interno, creado_por
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    async createOrdenLinea(client, lineaData) {
        const {
            id_orden,
            id_producto,
            descripcion,
            cantidad,
            precio,
            descuento,
            iva,
            total_bruto_linea,
            total_iva_linea,
            total_neto_linea
        } = lineaData;

        const query = `
      INSERT INTO ordenlinea (
        id_orden, id_producto, descripcion, cantidad, precio, 
        descuento, iva, total_bruto, total_iva, total_neto
      ) VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10
      ) RETURNING id
    `;

        const values = [
            id_orden, id_producto, descripcion, cantidad, precio,
            descuento, iva, total_bruto_linea, total_iva_linea, total_neto_linea
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
