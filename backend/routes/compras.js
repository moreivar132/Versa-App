const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyJWT = require('../middleware/auth');

async function registrarEntradaInventario(client, {
    productId,
    quantity,
    idAlmacen,
    idCompra,
    idUsuario
}) {
    const parsedQuantity = parseFloat(quantity);

    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
        throw new Error('La cantidad del item es inválida para actualizar stock.');
    }

    await client.query(`
        INSERT INTO movimientoinventario
        (id_producto, id_almacen, tipo, cantidad, origen_tipo, origen_id, created_at, created_by)
        VALUES ($1, $2, 'ENTRADA', $3, 'COMPRA', $4, NOW(), $5)
    `, [productId, idAlmacen, parsedQuantity, idCompra, idUsuario]);

    await client.query(
        'UPDATE producto SET stock = COALESCE(stock, 0) + $1 WHERE id = $2',
        [parsedQuantity, productId]
    );
}

// GET /api/compras - Listar compras (Historial)
router.get('/', verifyJWT, async (req, res) => {
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;
    const { limit = 50 } = req.query;

    console.log(`[DEBUG GET /api/compras] User: ${req.user.id}, Tenant: ${id_tenant}, SuperAdmin: ${isSuperAdmin}, Limit: ${limit}`);

    try {
        let query = `
            SELECT c.*, p.nombre as proveedor_nombre, s.nombre as sucursal_nombre, c.id_sucursal
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
        params.push(parseInt(limit));

        const result = await pool.query(query, params);
        console.log(`[DEBUG GET /api/compras] Devolviendo ${result.rows.length} compras`);
        res.json(result.rows);
    } catch (error) {
        console.error('[ERROR GET /api/compras]:', error);
        res.status(500).json({ error: 'Error al obtener historial de compras: ' + error.message });
    }
});

// POST /api/compras - Crear nueva compra
router.post('/', verifyJWT, async (req, res) => {
    console.log('POST /api/compras received. Body:', req.body);
    console.log('User:', req.user);
    const {
        id_proveedor,
        nombre_proveedor, // Fallback if ID is missing (create new?)
        id_sucursal,
        id_almacen, // Nuevo campo: Almacén destino
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

        // 1. Resolver Proveedor y Sucursal (Validación estricta)
        if (!id_sucursal) {
            throw new Error('El ID de sucursal es obligatorio.');
        }

        // Verificar existencia de sucursal
        const sucursalCheck = await client.query('SELECT id FROM sucursal WHERE id = $1', [id_sucursal]);
        if (sucursalCheck.rows.length === 0) {
            throw new Error('La sucursal especificada no existe.');
        }

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

        if (!finalProveedorId) {
            throw new Error('Debe especificar un proveedor válido o un nombre para crearlo.');
        }

        // 1.1 Resolver Almacén (Si no viene, buscar uno de la sucursal o crear uno por defecto)
        let finalAlmacenId = id_almacen;
        if (!finalAlmacenId) {
            const almacenRes = await client.query('SELECT id FROM almacen WHERE id_sucursal = $1 LIMIT 1', [id_sucursal]);
            if (almacenRes.rows.length > 0) {
                finalAlmacenId = almacenRes.rows[0].id;
            } else {
                // Crear almacén por defecto
                const sucursalNameRes = await client.query('SELECT nombre FROM sucursal WHERE id = $1', [id_sucursal]);
                const sucursalName = sucursalNameRes.rows[0]?.nombre || 'Sucursal';
                const createAlmacen = await client.query(
                    'INSERT INTO almacen (id_sucursal, nombre, created_at) VALUES ($1, $2, NOW()) RETURNING id',
                    [id_sucursal, `Almacén Principal - ${sucursalName}`]
                );
                finalAlmacenId = createAlmacen.rows[0].id;
            }
        }

        // 2. Insertar Cabecera (Inicialmente con total 0, se actualizará al final)
        // Ensure fecha_emision is formatted
        let fecha = new Date();
        if (fecha_emision) {
            const parsed = new Date(fecha_emision);
            if (!isNaN(parsed)) fecha = parsed;
        }

        const insertCabeceraQuery = `
            INSERT INTO compracabecera 
            (id_tenant, id_proveedor, id_sucursal, id_almacen, fecha_emision, metodo_pago, observaciones, total, created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NOW(), $8)
            RETURNING id
        `;

        const cabeceraRes = await client.query(insertCabeceraQuery, [
            id_tenant,
            finalProveedorId,
            id_sucursal,
            finalAlmacenId,
            fecha,
            metodo_pago,
            observaciones,
            id_usuario
        ]);

        const id_compra = cabeceraRes.rows[0].id;

        // 3. Insertar Líneas y Calcular Totales
        let calculatedTotal = 0;

        for (const item of items) {
            let productId = item.id_producto;
            const quantity = parseFloat(item.quantity);
            const price = parseFloat(item.price);
            const bonus = parseFloat(item.bonus) || 0;
            const iva = parseFloat(item.iva) || 0;

            if (Number.isNaN(quantity) || quantity <= 0) {
                throw new Error('Cada item debe tener una cantidad válida mayor a cero.');
            }

            if (Number.isNaN(price) || price < 0) {
                throw new Error('Cada item debe tener un precio válido.');
            }

            // Resolver Producto (Buscar o Crear) - Incluye id_sucursal para unicidad
            // IMPORTANTE: Al crear producto desde compra, incluir proveedor, costo y unidad de medida
            if (!productId && item.barcode) {
                const prodRes = await client.query(
                    'SELECT id FROM producto WHERE codigo_barras = $1 AND id_tenant = $2 AND id_sucursal = $3',
                    [item.barcode, id_tenant, id_sucursal]
                );
                if (prodRes.rows.length > 0) {
                    productId = prodRes.rows[0].id;
                    // Actualizar el producto existente con el proveedor si no lo tiene
                    await client.query(
                        `UPDATE producto SET 
                            id_proveedor = COALESCE(id_proveedor, $1),
                            costo = $2,
                            unidad_medida = COALESCE(unidad_medida, 'Unidades'),
                            updated_at = NOW()
                        WHERE id = $3`,
                        [finalProveedorId, price, productId]
                    );
                } else {
                    // Crear producto básico vinculado a la sucursal de la compra CON PROVEEDOR
                    const createProd = await client.query(
                        `INSERT INTO producto 
                            (id_tenant, codigo_barras, nombre, precio, costo, id_sucursal, id_proveedor, tipo, stock, unidad_medida, created_at) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NOW()) RETURNING id`,
                        [id_tenant, item.barcode, item.name, item.price, price, id_sucursal, finalProveedorId, item.type || 'Producto', item.unidad || 'Unidades']
                    );
                    productId = createProd.rows[0].id;
                }
            } else if (!productId) {
                // Producto sin código, buscar por nombre exacto y sucursal o crear
                const prodRes = await client.query(
                    'SELECT id FROM producto WHERE nombre = $1 AND id_tenant = $2 AND id_sucursal = $3',
                    [item.name, id_tenant, id_sucursal]
                );
                if (prodRes.rows.length > 0) {
                    productId = prodRes.rows[0].id;
                    // Actualizar el producto existente con el proveedor si no lo tiene
                    await client.query(
                        `UPDATE producto SET 
                            id_proveedor = COALESCE(id_proveedor, $1),
                            costo = $2,
                            unidad_medida = COALESCE(unidad_medida, 'Unidades'),
                            updated_at = NOW()
                        WHERE id = $3`,
                        [finalProveedorId, price, productId]
                    );
                } else {
                    const createProd = await client.query(
                        `INSERT INTO producto 
                            (id_tenant, nombre, precio, costo, id_sucursal, id_proveedor, tipo, stock, unidad_medida, created_at) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, NOW()) RETURNING id`,
                        [id_tenant, item.name, item.price, price, id_sucursal, finalProveedorId, item.type || 'Producto', item.unidad || 'Unidades']
                    );
                    productId = createProd.rows[0].id;
                }
            }


            if (!productId) {
                throw new Error(`No se pudo resolver el producto para el item: ${item.name}`);
            }

            // Obtener el porcentaje de IVA desde la tabla impuesto
            let ivaPorcentaje = 0;

            // Prioridad: 1) id_impuesto del item, 2) id_impuesto del producto en BD
            let idImpuesto = item.id_impuesto;

            if (!idImpuesto && productId) {
                // Buscar el id_impuesto del producto
                const prodImpuestoRes = await client.query(
                    'SELECT id_impuesto FROM producto WHERE id = $1',
                    [productId]
                );
                if (prodImpuestoRes.rows.length > 0 && prodImpuestoRes.rows[0].id_impuesto) {
                    idImpuesto = prodImpuestoRes.rows[0].id_impuesto;
                }
            }

            // Buscar el porcentaje del impuesto en la tabla impuesto
            if (idImpuesto) {
                const impuestoRes = await client.query(
                    'SELECT porcentaje FROM impuesto WHERE id = $1',
                    [idImpuesto]
                );
                if (impuestoRes.rows.length > 0) {
                    ivaPorcentaje = parseFloat(impuestoRes.rows[0].porcentaje) || 0;
                }
            }

            const insertLineaQuery = `
                INSERT INTO compralinea
                (id_compra, id_producto, descripcion, cantidad, precio_unitario, iva, total_linea)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;

            // Calcular total línea: (precio * cantidad - bonus) * (1 + iva/100)
            // El IVA se aplica sobre el subtotal (precio * cantidad - bonus)
            const subtotal = (price * quantity) - bonus;
            const ivaAmount = subtotal * (ivaPorcentaje / 100);
            const lineTotal = subtotal + ivaAmount;
            calculatedTotal += lineTotal;

            await client.query(insertLineaQuery, [
                id_compra,
                productId,
                item.name,
                quantity,
                price,
                ivaPorcentaje, // Guardar el porcentaje del impuesto
                lineTotal
            ]);

            await registrarEntradaInventario(client, {
                productId,
                quantity,
                idAlmacen: finalAlmacenId,
                idCompra: id_compra,
                idUsuario: id_usuario
            });
        }

        // 4. Actualizar Total en Cabecera
        await client.query(
            'UPDATE compracabecera SET total = $1 WHERE id = $2',
            [calculatedTotal, id_compra]
        );

        await client.query('COMMIT');
        res.json({ ok: true, id_compra, message: 'Compra registrada exitosamente', total: calculatedTotal });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar compra:', error);
        res.status(500).json({ error: 'Error al registrar la compra: ' + error.message });
    } finally {
        client.release();
    }
});

// GET /api/compras/:id/pdf - Generar PDF de la compra (DEBE IR ANTES DE /:id)
router.get('/:id/pdf', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    try {
        // Obtener datos de la compra (consulta simplificada)
        let query = `
            SELECT c.*, 
                   p.nombre as proveedor_nombre,
                   s.nombre as sucursal_nombre
            FROM compracabecera c
            LEFT JOIN proveedor p ON c.id_proveedor = p.id
            LEFT JOIN sucursal s ON c.id_sucursal = s.id
            WHERE c.id = $1
        `;
        let params = [id];

        if (!isSuperAdmin) {
            query += ` AND c.id_tenant = $2`;
            params.push(id_tenant);
        }

        const cabeceraRes = await pool.query(query, params);

        if (cabeceraRes.rows.length === 0) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        const compra = cabeceraRes.rows[0];

        // Obtener líneas
        const lineasRes = await pool.query(`
            SELECT cl.*, pr.nombre as producto_nombre, pr.codigo_barras
            FROM compralinea cl
            LEFT JOIN producto pr ON cl.id_producto = pr.id
            WHERE cl.id_compra = $1
        `, [id]);

        const lineas = lineasRes.rows;

        // Generar HTML del PDF
        let fechaEmision = 'Fecha no disponible';
        try {
            if (compra.fecha_emision) {
                fechaEmision = new Date(compra.fecha_emision).toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            }
        } catch (e) {
            console.log('Error parsing date:', e);
        }

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Compra #${id}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; padding: 40px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #FF652B; }
                .logo { font-size: 24px; font-weight: bold; color: #FF652B; }
                .doc-info { text-align: right; }
                .doc-title { font-size: 20px; font-weight: bold; color: #333; margin-bottom: 8px; }
                .doc-number { font-size: 14px; color: #666; }
                .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .party { width: 48%; }
                .party-title { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 8px; letter-spacing: 1px; }
                .party-name { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                .party-detail { font-size: 11px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                thead { background: #f8f8f8; }
                th { text-align: left; padding: 12px; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
                td { padding: 12px; border-bottom: 1px solid #eee; }
                .text-right { text-align: right; }
                .totals { margin-left: auto; width: 280px; }
                .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                .total-row.grand { font-size: 16px; font-weight: bold; color: #FF652B; border-top: 2px solid #333; border-bottom: none; padding-top: 12px; }
                .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">GOVERSA</div>
                <div class="doc-info">
                    <div class="doc-title">COMPRA</div>
                    <div class="doc-number">Nº ${String(id).padStart(6, '0')}</div>
                    <div class="doc-number">${fechaEmision}</div>
                </div>
            </div>
            
            <div class="parties">
                <div class="party">
                    <div class="party-title">Proveedor</div>
                    <div class="party-name">${compra.proveedor_nombre || 'N/A'}</div>
                </div>
                <div class="party">
                    <div class="party-title">Destino</div>
                    <div class="party-name">${compra.sucursal_nombre || 'N/A'}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th class="text-right">Cantidad</th>
                        <th class="text-right">Precio Unit.</th>
                        <th class="text-right">IVA %</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineas.map(l => `
                        <tr>
                            <td>${l.codigo_barras || '-'}</td>
                            <td>${l.descripcion || l.producto_nombre || 'Producto'}</td>
                            <td class="text-right">${l.cantidad || 0}</td>
                            <td class="text-right">${(parseFloat(l.precio_unitario) || 0).toFixed(2)} €</td>
                            <td class="text-right">${l.iva || 0}%</td>
                            <td class="text-right">${(parseFloat(l.total_linea) || 0).toFixed(2)} €</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span>${(parseFloat(compra.total) || 0).toFixed(2)} €</span>
                </div>
                <div class="total-row grand">
                    <span>TOTAL</span>
                    <span>${(parseFloat(compra.total) || 0).toFixed(2)} €</span>
                </div>
            </div>
            
            ${compra.observaciones ? `<div style="margin-top: 30px; padding: 15px; background: #f8f8f8; border-radius: 4px;"><strong>Observaciones:</strong> ${compra.observaciones}</div>` : ''}
            
            <div class="footer">
                <p>Documento generado el ${new Date().toLocaleDateString('es-ES')} - Goversa © ${new Date().getFullYear()}</p>
            </div>
        </body>
        </html>
        `;

        // Enviar como HTML (para visualizar/imprimir)
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);

    } catch (error) {
        console.error('Error al generar PDF de compra:', error);
        res.status(500).json({ error: 'Error al generar el documento' });
    }
});

// GET /api/compras/:id - Obtener una compra por ID (DEBE IR DESPUÉS DE /:id/pdf)
router.get('/:id', verifyJWT, async (req, res) => {
    // Validación estricta del ID
    if (!req.params.id || !/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ error: 'ID de compra inválido (debe ser numérico)' });
    }
    const id = parseInt(req.params.id);

    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    console.log(`[DEBUG] GET /api/compras/${id} - User: ${req.user.id}, Tenant: ${id_tenant}`);

    try {
        // Query simplificada para reducir posibles puntos de fallo
        let query = `
            SELECT c.*, p.nombre as proveedor_nombre, p.cif as proveedor_nif, 
                   s.nombre as sucursal_nombre
            FROM compracabecera c
            LEFT JOIN proveedor p ON c.id_proveedor = p.id
            LEFT JOIN sucursal s ON c.id_sucursal = s.id
            WHERE c.id = $1
        `;
        let params = [id];

        if (!isSuperAdmin) {
            query += ` AND c.id_tenant = $2`;
            params.push(id_tenant);
        }

        const cabeceraRes = await pool.query(query, params);

        if (cabeceraRes.rows.length === 0) {
            console.log(`[DEBUG] Compra ${id} no encontrada o acceso denegado para tenant ${id_tenant}`);
            return res.status(404).json({ error: 'Compra no encontrada o no tienes permisos para verla.' });
        }

        // Obtener líneas de la compra
        const lineasRes = await pool.query(`
            SELECT cl.*, pr.nombre as producto_nombre, pr.codigo_barras
            FROM compralinea cl
            LEFT JOIN producto pr ON cl.id_producto = pr.id
            WHERE cl.id_compra = $1
        `, [id]);

        console.log(`[DEBUG] Compra ${id} encontrada. Líneas: ${lineasRes.rows.length}`);

        res.json({
            ...cabeceraRes.rows[0],
            lineas: lineasRes.rows,
            items: lineasRes.rows
        });

    } catch (error) {
        console.error(`[CRITICAL ERROR] GET /api/compras/${id}:`, error);
        res.status(500).json({
            error: 'Error interno al cargar los datos de la compra.',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// PUT /api/compras/:id - Actualizar compra existente
router.put('/:id', verifyJWT, async (req, res) => {
    console.log(`PUT /api/compras/${req.params.id} request received`);
    const { id } = req.params;
    const {
        id_proveedor,
        nombre_proveedor,
        id_sucursal,
        fecha_emision,
        metodo_pago,
        observaciones,
        items,
        total_final
    } = req.body;

    const id_tenant = req.user.id_tenant;
    const id_usuario = req.user.id;
    const isSuperAdmin = req.user.is_super_admin;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verificar existencia y permisos
        let checkQuery = 'SELECT id FROM compracabecera WHERE id = $1';
        let checkParams = [id];
        if (!isSuperAdmin) {
            checkQuery += ' AND id_tenant = $2';
            checkParams.push(id_tenant);
        }
        const checkRes = await client.query(checkQuery, checkParams);
        if (checkRes.rows.length === 0) {
            // Si es admin, permitir editar aunque no sea de su tenant (caso borde o error de permisos legacy)
            // PERO SOLO SI EL TENANT COINCIDE O ES SUPER ADMIN.
            // Si el check falló con el tenant, probamos sin tenant para loguear
            const checkExist = await client.query('SELECT id, id_tenant FROM compracabecera WHERE id = $1', [id]);
            if (checkExist.rows.length === 0) {
                throw new Error('Compra no encontrada.');
            } else {
                const realTenant = checkExist.rows[0].id_tenant;
                if (!isSuperAdmin && String(realTenant) !== String(id_tenant)) {
                    throw new Error(`Permiso denegado. La compra pertenece al tenant ${realTenant} y tú eres ${id_tenant}`);
                }
            }
        }

        // 2. Actualizar Cabecera
        let fecha = new Date();
        if (fecha_emision) fecha = new Date(fecha_emision);

        await client.query(`
            UPDATE compracabecera 
            SET id_proveedor = $1, id_sucursal = $2, fecha_emision = $3, metodo_pago = $4, observaciones = $5, total = $6
            WHERE id = $7
        `, [id_proveedor, id_sucursal, fecha, metodo_pago, observaciones, 0, id]); // Total update later

        // 3. Reemplazar Líneas (Estrategia: Eliminar e Insertar)

        // A. REVERTIR STOCK DE LÍNEAS ANTERIORES
        // Obtener líneas actuales antes de borrar
        const oldLines = await client.query('SELECT id_producto, cantidad FROM compralinea WHERE id_compra = $1', [id]);

        for (const oldLine of oldLines.rows) {
            if (oldLine.id_producto && oldLine.cantidad) {
                await client.query(
                    'UPDATE producto SET stock = stock - $1 WHERE id = $2',
                    [oldLine.cantidad, oldLine.id_producto]
                );
            }
        }

        // B. BORRAR REGISTROS PREVIOS
        await client.query("DELETE FROM movimientoinventario WHERE origen_tipo = 'COMPRA' AND origen_id = $1", [id]);
        await client.query("DELETE FROM compralinea WHERE id_compra = $1", [id]);

        // C. INSERTAR NUEVAS LÍNEAS
        let calculatedTotal = 0;

        // Resolver Almacén (Reusar existente o default)
        const almacenRes = await client.query('SELECT id FROM almacen WHERE id_sucursal = $1 LIMIT 1', [id_sucursal]);
        const finalAlmacenId = almacenRes.rows[0]?.id;

        for (const item of items) {
            let productId = item.id_producto;
            const quantity = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const bonus = parseFloat(item.bonus) || 0;

            // Resolver/Actualizar Producto (Igual que en POST)
            if (!productId && item.barcode) {
                const prodRes = await client.query(
                    'SELECT id FROM producto WHERE codigo_barras = $1 AND id_tenant = $2 AND id_sucursal = $3',
                    [item.barcode, id_tenant, id_sucursal]
                );
                if (prodRes.rows.length > 0) {
                    productId = prodRes.rows[0].id;
                } else {
                    // Crear producto si no existe
                    const createProd = await client.query(
                        `INSERT INTO producto 
                             (id_tenant, codigo_barras, nombre, precio, costo, id_sucursal, id_proveedor, tipo, stock, unidad_medida, created_at) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NOW()) RETURNING id`,
                        [id_tenant, item.barcode, item.name, price, price, id_sucursal, id_proveedor, item.type || 'Producto', 'Unidades']
                    );
                    productId = createProd.rows[0].id;
                }
            } else if (!productId) {
                // Buscar por nombre
                const prodRes = await client.query(
                    'SELECT id FROM producto WHERE nombre = $1 AND id_tenant = $2 AND id_sucursal = $3',
                    [item.name, id_tenant, id_sucursal]
                );
                if (prodRes.rows.length > 0) {
                    productId = prodRes.rows[0].id;
                } else {
                    const createProd = await client.query(
                        `INSERT INTO producto 
                             (id_tenant, nombre, precio, costo, id_sucursal, id_proveedor, tipo, stock, unidad_medida, created_at) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, NOW()) RETURNING id`,
                        [id_tenant, item.name, price, price, id_sucursal, id_proveedor, item.type || 'Producto', 'Unidades']
                    );
                    productId = createProd.rows[0].id;
                }
            }

            if (productId) {
                // Recuperar IVA real si id_impuesto existe (logic simple)
                const iva = parseFloat(item.iva) || 0;
                const subtotal = (price * quantity) - bonus;
                const lineTotal = subtotal * (1 + (iva / 100));
                calculatedTotal += lineTotal;

                await client.query(`
                    INSERT INTO compralinea (id_compra, id_producto, descripcion, cantidad, precio_unitario, iva, total_linea)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                 `, [id, productId, item.name, quantity, price, iva, lineTotal]);

                if (finalAlmacenId) {
                    await registrarEntradaInventario(client, {
                        productId, quantity, idAlmacen: finalAlmacenId, idCompra: id, idUsuario: id_usuario
                    });
                }
            }
        }

        // Actualizar total
        await client.query('UPDATE compracabecera SET total = $1 WHERE id = $2', [calculatedTotal, id]);

        await client.query('COMMIT');
        res.json({ ok: true });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error PUT /compras:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// DELETE /api/compras/:id - Eliminar compra
router.delete('/:id', verifyJWT, async (req, res) => {
    const { id } = req.params;
    const id_tenant = req.user.id_tenant;
    const isSuperAdmin = req.user.is_super_admin;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verificar que la compra existe y pertenece al tenant
        let checkQuery = 'SELECT id FROM compracabecera WHERE id = $1';
        let checkParams = [id];

        if (!isSuperAdmin) {
            checkQuery += ' AND id_tenant = $2';
            checkParams.push(id_tenant);
        }

        const checkRes = await client.query(checkQuery, checkParams);

        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        // Eliminar movimientos de inventario relacionados
        await client.query(
            `DELETE FROM movimientoinventario WHERE origen_tipo = 'COMPRA' AND origen_id = $1`,
            [id]
        );

        // Eliminar líneas de compra
        await client.query('DELETE FROM compralinea WHERE id_compra = $1', [id]);

        // Eliminar cabecera
        await client.query('DELETE FROM compracabecera WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ ok: true, message: 'Compra eliminada correctamente' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar compra:', error);
        res.status(500).json({ error: 'Error al eliminar la compra' });
    } finally {
        client.release();
    }
});

module.exports = router;
