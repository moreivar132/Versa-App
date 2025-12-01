const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// GET /api/compras - Listar compras (Historial)
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;
    const { limit = 50 } = req.query;

    try {
        let query = `
            SELECT c.*, p.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM compracabecera c
            LEFT JOIN proveedor p ON c.id_proveedor = p.id
            LEFT JOIN sucursal s ON c.id_sucursal = s.id
        `;

        let params = [];

        if (!isSuperAdmin) {
            query += ` WHERE c.id_tenant = $1`;
            params.push(id_tenant);
        }

        query += ` ORDER BY c.fecha_emision DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener compras:', error);
        res.status(500).json({ error: 'Error al obtener historial de compras' });
    }
});

// POST /api/compras - Crear nueva compra
router.post('/', verifyJWT, async (req, res) => {
    const {
        id_proveedor,
        nombre_proveedor, // Fallback if ID is missing (create new?)
        id_sucursal,
        fecha_emision,
        metodo_pago,
        observaciones,
        items, // Array of { id_producto (optional), name, barcode, quantity, price, iva, bonus }
        total_final
    } = req.body;

    const id_tenant = req.user.id_tenant;
    const id_usuario = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'La compra debe tener al menos un item.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Resolver Proveedor
        let finalProveedorId = id_proveedor;
        if (!finalProveedorId && nombre_proveedor) {
            // Intentar buscar por nombre o crear
            const provRes = await client.query('SELECT id FROM proveedor WHERE nombre = $1 AND id_tenant = $2', [nombre_proveedor, id_tenant]);
            if (provRes.rows.length > 0) {
                finalProveedorId = provRes.rows[0].id;
            } else {
                const createProv = await client.query(
                    'INSERT INTO proveedor (id_tenant, nombre, created_at) VALUES ($1, $2, NOW()) RETURNING id',
                    [id_tenant, nombre_proveedor]
                );
                finalProveedorId = createProv.rows[0].id;
            }
        }

        // 2. Insertar Cabecera
        const insertCabeceraQuery = `
            INSERT INTO compracabecera 
            (id_tenant, id_proveedor, id_sucursal, fecha_emision, metodo_pago, observaciones, total, created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
            RETURNING id
        `;

        // Ensure fecha_emision is formatted
        // Frontend sends localized string, might need parsing or just use NOW() if invalid
        // Ideally frontend sends ISO string. We'll handle that in frontend.
        // For now, let's assume it's a valid date string or default to NOW
        let fecha = new Date();
        if (fecha_emision) {
            const parsed = new Date(fecha_emision);
            if (!isNaN(parsed)) fecha = parsed;
        }

        const cabeceraRes = await client.query(insertCabeceraQuery, [
            id_tenant,
            finalProveedorId,
            id_sucursal,
            fecha,
            metodo_pago,
            observaciones,
            total_final,
            id_usuario
        ]);

        const id_compra = cabeceraRes.rows[0].id;

        // 3. Insertar Líneas
        for (const item of items) {
            let productId = item.id_producto;

            // Si no hay ID pero hay código de barras, buscar o crear producto
            if (!productId && item.barcode) {
                const prodRes = await client.query(
                    'SELECT id FROM producto WHERE codigo_barras = $1 AND id_tenant = $2',
                    [item.barcode, id_tenant]
                );
                if (prodRes.rows.length > 0) {
                    productId = prodRes.rows[0].id;
                } else {
                    // Crear producto básico
                    const createProd = await client.query(
                        'INSERT INTO producto (id_tenant, codigo_barras, nombre, precio, id_sucursal, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
                        [id_tenant, item.barcode, item.name, item.price, id_sucursal]
                    );
                    productId = createProd.rows[0].id;
                }
            } else if (!productId && !item.barcode) {
                // Producto sin código, buscar por nombre exacto o crear
                const prodRes = await client.query(
                    'SELECT id FROM producto WHERE nombre = $1 AND id_tenant = $2',
                    [item.name, id_tenant]
                );
                if (prodRes.rows.length > 0) {
                    productId = prodRes.rows[0].id;
                } else {
                    const createProd = await client.query(
                        'INSERT INTO producto (id_tenant, nombre, precio, id_sucursal, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
                        [id_tenant, item.name, item.price, id_sucursal]
                    );
                    productId = createProd.rows[0].id;
                }
            }

            const insertLineaQuery = `
                INSERT INTO compralinea
                (id_compra, id_producto, descripcion, cantidad, precio_unitario, iva, total_linea)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;

            const lineTotal = (item.price * item.quantity) - (item.bonus || 0);

            await client.query(insertLineaQuery, [
                id_compra,
                productId,
                item.name,
                item.quantity,
                item.price,
                item.iva,
                lineTotal
            ]);

            // Opcional: Actualizar stock si existiera columna stock
            // await client.query('UPDATE producto SET stock = stock + $1 WHERE id = $2', [item.quantity, productId]);
        }

        await client.query('COMMIT');
        res.json({ ok: true, id_compra, message: 'Compra registrada exitosamente' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar compra:', error);
        res.status(500).json({ error: 'Error al registrar la compra: ' + error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
