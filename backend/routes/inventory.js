const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// GET /api/inventory/search - Search products
router.get('/search', verifyJWT, async (req, res) => {
    const { q } = req.query;
    const id_tenant = req.user.id_tenant;

    if (!q) {
        return res.status(400).json({ error: 'Parámetro de búsqueda requerido (q)' });
    }

    try {
        const searchTerm = `%${q}%`;
        // Search by name or barcode
        const query = `
            SELECT p.*, pr.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM producto p
            LEFT JOIN proveedor pr ON p.id_proveedor = pr.id
            LEFT JOIN sucursal s ON p.id_sucursal = s.id
            WHERE p.id_tenant = $1 
            AND (p.nombre ILIKE $2 OR p.codigo_barras ILIKE $2 OR p.modelo ILIKE $2)
            LIMIT 20
        `;

        const result = await pool.query(query, [id_tenant, searchTerm]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en búsqueda de inventario:', error);
        res.status(500).json({ error: 'Error al buscar productos' });
    }
});

// POST /api/inventory - Create or Update product
router.post('/', verifyJWT, async (req, res) => {
    const {
        codigo_barras_articulo, // Frontend sends this name
        nombre,
        modelo,
        descripcion,
        marca,
        id_categoria,
        proveedor, // This might be name, need to handle ID lookup if possible, or just store ID if frontend sends ID
        taller, // Name of sucursal
        costo_compra,
        recargo,
        precio_venta_bruto,
        iva,
        stock,
        stock_minimo,
        unidad_medida,
        activo
    } = req.body;

    const id_tenant = req.user.id_tenant;

    if (!nombre || !codigo_barras_articulo) {
        return res.status(400).json({ error: 'Nombre y Código de Barras son obligatorios.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Resolve Sucursal ID
        let id_sucursal = null;
        if (taller) {
            const sucursalRes = await client.query('SELECT id FROM sucursal WHERE nombre = $1 AND id_tenant = $2', [taller, id_tenant]);
            if (sucursalRes.rows.length > 0) {
                id_sucursal = sucursalRes.rows[0].id;
            }
        }

        // 2. Resolve Proveedor ID (Find or Create)
        let id_proveedor = null;
        if (proveedor) {
            const provRes = await client.query('SELECT id FROM proveedor WHERE nombre = $1 AND id_tenant = $2', [proveedor, id_tenant]);
            if (provRes.rows.length > 0) {
                id_proveedor = provRes.rows[0].id;
            } else {
                // Create new provider automatically
                const createProvRes = await client.query(
                    'INSERT INTO proveedor (nombre, id_tenant, created_at, created_by) VALUES ($1, $2, NOW(), $3) RETURNING id',
                    [proveedor, id_tenant, req.user.id]
                );
                id_proveedor = createProvRes.rows[0].id;
            }
        }

        // 3. Check if product exists (by barcode)
        const checkQuery = 'SELECT id FROM producto WHERE codigo_barras = $1 AND id_tenant = $2';
        const checkRes = await client.query(checkQuery, [codigo_barras_articulo, id_tenant]);

        let result;
        if (checkRes.rows.length > 0) {
            // UPDATE
            const updateQuery = `
                UPDATE producto
                SET nombre = $3, modelo = $4, descripcion = $5, marca = $6, categoria = $7, 
                    id_proveedor = $8, id_sucursal = $9, costo = $10, recargo = $11, precio = $12, 
                    id_impuesto = $13, stock_minimo = $14, unidad_medida = $15, activo = $16,
                    updated_at = NOW(), updated_by = $17
                WHERE id = $1 AND id_tenant = $2
                RETURNING *
            `;
            // Note: 'stock' is usually handled via movements, but for simple CRUD we might update it directly or ignore it?
            // The form has 'Stock Actual'. Updating it directly on product table if we treat it as a cache, 
            // OR we should create an inventory movement. For now, let's assume simple update if column exists, 
            // but 'producto' table doesn't have 'stock' column in original schema, we didn't add it?
            // Wait, original schema had 'movimientoinventario'. 
            // Let's check if we added 'stock' column. We didn't add 'stock' column in the migration script!
            // We added 'stock_minimo'. 
            // We should probably add 'stock_actual' to producto for simple caching or use movimientoinventario.
            // For this MVP, let's add 'stock_actual' to producto or just update the other fields.
            // I will assume for now we just update the product details. 

            result = await client.query(updateQuery, [
                checkRes.rows[0].id, id_tenant,
                nombre, modelo, descripcion, marca, id_categoria,
                id_proveedor, id_sucursal, costo_compra, recargo, precio_venta_bruto,
                null, // id_impuesto (need to resolve iva to id_impuesto or just store iva?)
                stock_minimo, unidad_medida, activo,
                req.user.id
            ]);

        } else {
            // INSERT
            const insertQuery = `
                INSERT INTO producto
                (id_tenant, codigo_barras, nombre, modelo, descripcion, marca, categoria, 
                 id_proveedor, id_sucursal, costo, recargo, precio, stock_minimo, unidad_medida, activo,
                 created_at, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16)
                RETURNING *
            `;
            result = await client.query(insertQuery, [
                id_tenant, codigo_barras_articulo, nombre, modelo, descripcion, marca, id_categoria,
                id_proveedor, id_sucursal, costo_compra, recargo, precio_venta_bruto,
                stock_minimo, unidad_medida, activo,
                req.user.id
            ]);
        }

        await client.query('COMMIT');
        res.json({ ok: true, product: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al guardar producto:', error);
        res.status(500).json({ error: 'Error al guardar producto' });
    } finally {
        client.release();
    }
});

module.exports = router;
