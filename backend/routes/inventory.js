const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

// GET /api/inventory - List products (with optional search/filter)
router.get('/', verifyJWT, async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const { q, category, provider } = req.query;
    const id_tenant = req.user.id_tenant;

    console.log(`Listing inventory for tenant ${id_tenant}. Limit: ${limit}, Offset: ${offset}, Q: ${q}, Cat: ${category}, Prov: ${provider}`);

    try {
        let query = `
            SELECT p.*, pr.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM producto p
            LEFT JOIN proveedor pr ON p.id_proveedor = pr.id
            LEFT JOIN sucursal s ON p.id_sucursal = s.id
            WHERE p.id_tenant = $1
        `;
        const params = [id_tenant];

        if (q) {
            query += ` AND (p.nombre ILIKE $${params.length + 1} OR p.codigo_barras ILIKE $${params.length + 1} OR p.modelo ILIKE $${params.length + 1})`;
            params.push(`%${q}%`);
        }

        if (category && category !== 'Todas las Categorías') {
            query += ` AND p.categoria = $${params.length + 1}`;
            params.push(category);
        }

        if (provider && provider !== 'Todos los Proveedores') {
            // Assuming provider is ID if numeric, else ignore or handle name? 
            // The frontend usually sends ID for filters if we build it that way.
            // Let's assume it sends ID.
            if (!isNaN(provider)) {
                query += ` AND p.id_proveedor = $${params.length + 1}`;
                params.push(provider);
            }
        }

        query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al listar inventario:', error);
        res.status(500).json({ error: 'Error al obtener productos: ' + error.message });
    }
});

// GET /api/inventory/resumen - Aggregated inventory grouped by codigo_barras
router.get('/resumen', verifyJWT, async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const { q, category, provider } = req.query;
    const id_tenant = req.user.id_tenant;

    try {
        let filterClause = 'WHERE p.id_tenant = $1';
        const params = [id_tenant];

        if (q) {
            filterClause += ` AND (p.nombre ILIKE $${params.length + 1} OR p.codigo_barras ILIKE $${params.length + 1} OR p.modelo ILIKE $${params.length + 1})`;
            params.push(`%${q}%`);
        }

        if (category && category !== 'Todas las Categorías') {
            filterClause += ` AND p.categoria = $${params.length + 1}`;
            params.push(category);
        }

        if (provider && provider !== 'Todos los Proveedores' && !isNaN(provider)) {
            filterClause += ` AND p.id_proveedor = $${params.length + 1}`;
            params.push(provider);
        }

        const query = `
            WITH aggregated AS (
                SELECT
                    MIN(p.id) AS id_representative,
                    p.codigo_barras,
                    p.nombre,
                    p.id_sucursal,
                    MIN(p.id_proveedor) AS id_proveedor,
                    MIN(p.categoria) AS categoria,
                    SUM(p.stock) AS stock_total,
                    MIN(p.stock_minimo) AS stock_minimo, -- Usamos el mínimo como umbral más conservador
                    MAX(p.precio) AS precio_representativo, -- Precio más alto para no subestimar
                    MAX(p.marca) AS marca,
                    MAX(p.modelo) AS modelo,
                    MIN(p.unidad_medida) AS unidad_medida
                FROM producto p
                ${filterClause}
                GROUP BY p.codigo_barras, p.nombre, p.id_sucursal
            )
            SELECT a.*, pr.nombre AS proveedor_nombre, s.nombre AS sucursal_nombre
            FROM aggregated a
            LEFT JOIN proveedor pr ON a.id_proveedor = pr.id
            LEFT JOIN sucursal s ON a.id_sucursal = s.id
            ORDER BY a.nombre ASC, a.codigo_barras ASC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2};
        `;

        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener resumen de inventario:', error);
        res.status(500).json({ error: 'Error al obtener resumen de inventario' });
    }
});

// GET /api/inventory/categories - List distinct categories
router.get('/categories', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    try {
        const result = await pool.query(
            'SELECT DISTINCT categoria FROM producto WHERE id_tenant = $1 AND categoria IS NOT NULL ORDER BY categoria',
            [id_tenant]
        );
        res.json(result.rows.map(r => r.categoria));
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// GET /api/inventory/export - Export to CSV
router.get('/export', verifyJWT, async (req, res) => {
    const { q, category, provider } = req.query;
    const id_tenant = req.user.id_tenant;

    try {
        let query = `
            SELECT p.codigo_barras, p.nombre, p.marca, p.modelo, p.categoria, 
                   pr.nombre as proveedor, s.nombre as sucursal, 
                   p.stock_minimo, p.unidad_medida, p.costo, p.precio
            FROM producto p
            LEFT JOIN proveedor pr ON p.id_proveedor = pr.id
            LEFT JOIN sucursal s ON p.id_sucursal = s.id
            WHERE p.id_tenant = $1
        `;
        const params = [id_tenant];

        if (q) {
            query += ` AND (p.nombre ILIKE $${params.length + 1} OR p.codigo_barras ILIKE $${params.length + 1} OR p.modelo ILIKE $${params.length + 1})`;
            params.push(`%${q}%`);
        }
        if (category && category !== 'Todas las Categorías') {
            query += ` AND p.categoria = $${params.length + 1}`;
            params.push(category);
        }
        if (provider && provider !== 'Todos los Proveedores' && !isNaN(provider)) {
            query += ` AND p.id_proveedor = $${params.length + 1}`;
            params.push(provider);
        }

        query += ` ORDER BY p.created_at DESC`;

        const result = await pool.query(query, params);

        // Generate CSV
        const headers = ['Código', 'Nombre', 'Marca', 'Modelo', 'Categoría', 'Proveedor', 'Sucursal', 'Stock Min', 'Unidad', 'Costo', 'Precio'];
        let csv = headers.join(',') + '\n';

        result.rows.forEach(row => {
            const line = [
                row.codigo_barras || '',
                `"${(row.nombre || '').replace(/"/g, '""')}"`,
                row.marca || '',
                row.modelo || '',
                row.categoria || '',
                `"${(row.proveedor || '').replace(/"/g, '""')}"`,
                row.sucursal || '',
                row.stock_minimo || 0,
                row.unidad_medida || '',
                row.costo || 0,
                row.precio || 0
            ];
            csv += line.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventario.csv');
        res.send(csv);

    } catch (error) {
        console.error('Error exportando inventario:', error);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// GET /api/inventory/search - Search products (Specific autocomplete endpoint)
router.get('/search', verifyJWT, async (req, res) => {
    const { q, id_sucursal } = req.query;
    const id_tenant = req.user.id_tenant;

    if (!q) {
        return res.status(400).json({ error: 'Parámetro de búsqueda requerido (q)' });
    }

    const sucursalId = parseInt(id_sucursal, 10);

    if (!id_sucursal || Number.isNaN(sucursalId)) {
        return res.status(400).json({ error: 'Debe especificar la sucursal' });
    }

    try {
        const sucursalValida = await pool.query('SELECT id FROM sucursal WHERE id = $1 AND id_tenant = $2', [sucursalId, id_tenant]);
        if (sucursalValida.rows.length === 0) {
            return res.status(404).json({ error: 'Sucursal no válida para el tenant' });
        }

        const searchTerm = `%${q}%`;
        const query = `
            SELECT p.*, pr.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM producto p
            LEFT JOIN proveedor pr ON p.id_proveedor = pr.id
            LEFT JOIN sucursal s ON p.id_sucursal = s.id
            WHERE p.id_tenant = $1
            AND p.id_sucursal = $2
            AND (p.nombre ILIKE $3 OR p.codigo_barras ILIKE $3 OR p.modelo ILIKE $3)
            LIMIT 20
        `;

        const result = await pool.query(query, [id_tenant, sucursalId, searchTerm]);
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
        categoria, // Changed from id_categoria to categoria
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

        // Normalize numeric fields
        const parsedCosto = parseFloat(costo_compra) || 0;
        const parsedRecargo = parseFloat(recargo) || 0;
        const parsedPrecio = parseFloat(precio_venta_bruto) || 0;
        const parsedStock = parseFloat(stock) || 0;
        const parsedStockMinimo = parseFloat(stock_minimo) || 0;

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
                    stock = $17,
                    updated_at = NOW(), updated_by = $18
                WHERE id = $1 AND id_tenant = $2
                RETURNING *
            `;

            result = await client.query(updateQuery, [
                checkRes.rows[0].id, id_tenant,
                nombre, modelo, descripcion, marca, categoria,
                id_proveedor, id_sucursal, parsedCosto, parsedRecargo, parsedPrecio,
                null, // id_impuesto
                parsedStockMinimo, unidad_medida, activo,
                parsedStock, // Update stock
                req.user.id
            ]);

        } else {
            // INSERT
            const insertQuery = `
                INSERT INTO producto
                (id_tenant, codigo_barras, nombre, modelo, descripcion, marca, categoria, 
                 id_proveedor, id_sucursal, costo, recargo, precio, stock_minimo, unidad_medida, activo,
                 tipo, stock, created_at, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), $18)
                RETURNING *
            `;
            result = await client.query(insertQuery, [
                id_tenant, codigo_barras_articulo, nombre, modelo, descripcion, marca, categoria,
                id_proveedor, id_sucursal, parsedCosto, parsedRecargo, parsedPrecio,
                parsedStockMinimo, unidad_medida, activo,
                'Producto', // Default tipo
                parsedStock, // Initial stock
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

// GET /api/inventory/:id - Get single product
router.get('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const id_tenant = req.user.id_tenant;

    try {
        const query = `
            SELECT p.*, pr.nombre as proveedor_nombre, s.nombre as sucursal_nombre
            FROM producto p
            LEFT JOIN proveedor pr ON p.id_proveedor = pr.id
            LEFT JOIN sucursal s ON p.id_sucursal = s.id
            WHERE p.id = $1 AND p.id_tenant = $2
        `;
        const result = await pool.query(query, [id, id_tenant]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

// PUT /api/inventory/:id - Update product
router.put('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const {
        codigo_barras_articulo,
        nombre,
        modelo,
        descripcion,
        marca,
        id_categoria, // Frontend might send category name as 'categoria' or ID? Schema has 'categoria' (text) and 'id_categoria' (int)? 
        // Schema check said 'categoria' (text) exists. 'id_categoria' was not in the list in Step 80.
        // Step 80 output: 'categoria' (text). No 'id_categoria'.
        // So we should use 'categoria' field.
        categoria,    // Use this.
        proveedor,    // Name
        taller,       // Name
        costo_compra,
        recargo,
        precio_venta_bruto,
        stock_minimo,
        unidad_medida,
        activo
    } = req.body;

    const id_tenant = req.user.id_tenant;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const parsedCosto = parseFloat(costo_compra) || 0;
        const parsedRecargo = parseFloat(recargo) || 0;
        const parsedPrecio = parseFloat(precio_venta_bruto) || 0;
        const parsedStockMinimo = parseFloat(stock_minimo) || 0;
        const parsedStock = parseFloat(stock) || 0;

        // 1. Resolve Sucursal ID
        let id_sucursal = null;
        if (taller) {
            const sucursalRes = await client.query('SELECT id FROM sucursal WHERE nombre = $1 AND id_tenant = $2', [taller, id_tenant]);
            if (sucursalRes.rows.length > 0) id_sucursal = sucursalRes.rows[0].id;
        }

        // 2. Resolve Proveedor ID
        let id_proveedor = null;
        if (proveedor) {
            const provRes = await client.query('SELECT id FROM proveedor WHERE nombre = $1 AND id_tenant = $2', [proveedor, id_tenant]);
            if (provRes.rows.length > 0) {
                id_proveedor = provRes.rows[0].id;
            } else {
                const createProvRes = await client.query(
                    'INSERT INTO proveedor (nombre, id_tenant, created_at, created_by) VALUES ($1, $2, NOW(), $3) RETURNING id',
                    [proveedor, id_tenant, req.user.id]
                );
                id_proveedor = createProvRes.rows[0].id;
            }
        }

        const updateQuery = `
            UPDATE producto
            SET nombre = $1, modelo = $2, descripcion = $3, marca = $4, categoria = $5,
                id_proveedor = $6, id_sucursal = $7, costo = $8, recargo = $9, precio = $10,
                stock_minimo = $11, unidad_medida = $12, activo = $13, codigo_barras = $14,
                stock = $15,
                updated_at = NOW(), updated_by = $16
            WHERE id = $17 AND id_tenant = $18
            RETURNING *
        `;

        const result = await client.query(updateQuery, [
            nombre, modelo, descripcion, marca, categoria,
            id_proveedor, id_sucursal, parsedCosto, parsedRecargo, parsedPrecio,
            parsedStockMinimo, unidad_medida, activo, codigo_barras_articulo,
            parsedStock, // Add stock from body
            req.user.id, id, id_tenant
        ]);

        if (result.rows.length === 0) {
            throw new Error('Producto no encontrado o no autorizado');
        }

        await client.query('COMMIT');
        res.json({ ok: true, product: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error al actualizar producto: ' + error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
