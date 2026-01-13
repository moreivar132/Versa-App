/**
 * Contabilidad Repository
 * Acceso a datos para el módulo de contabilidad
 * Todas las queries usan tenant context obligatorio
 */

const pool = require('../../../../db');

class ContabilidadRepository {
    // ===================================================================
    // FACTURAS
    // ===================================================================

    /**
     * Lista facturas con filtros
     */
    async listFacturas(tenantId, filters = {}) {
        const {
            tipo,
            estado,
            fechaDesde,
            fechaHasta,
            trimestre,
            anio,
            idContacto,
            idCategoria,
            idSucursal,
            search,
            limit = 50,
            offset = 0
        } = filters;

        let query = `
            SELECT 
                f.*,
                c.nombre as contacto_nombre,
                c.nif_cif as contacto_nif,
                cat.nombre as categoria_nombre,
                s.nombre as sucursal_nombre,
                (SELECT COUNT(*) FROM contabilidad_factura_archivo WHERE id_factura = f.id) as archivos_count,
                (SELECT COUNT(*) FROM contabilidad_pago WHERE id_factura = f.id) as pagos_count
            FROM contabilidad_factura f
            LEFT JOIN contabilidad_contacto c ON f.id_contacto = c.id
            LEFT JOIN contable_category cat ON f.id_categoria = cat.id
            LEFT JOIN sucursal s ON f.id_sucursal = s.id
            WHERE f.id_tenant = $1 AND f.deleted_at IS NULL
        `;
        const params = [tenantId];
        let paramIndex = 2;

        if (tipo) {
            query += ` AND f.tipo = $${paramIndex++}`;
            params.push(tipo);
        }

        if (estado) {
            query += ` AND f.estado = $${paramIndex++}`;
            params.push(estado);
        }

        if (fechaDesde) {
            query += ` AND f.fecha_devengo >= $${paramIndex++}`;
            params.push(fechaDesde);
        }

        if (fechaHasta) {
            query += ` AND f.fecha_devengo <= $${paramIndex++}`;
            params.push(fechaHasta);
        }

        if (trimestre && anio) {
            query += ` AND EXTRACT(QUARTER FROM f.fecha_devengo) = $${paramIndex++}`;
            params.push(trimestre);
            query += ` AND EXTRACT(YEAR FROM f.fecha_devengo) = $${paramIndex++}`;
            params.push(anio);
        }

        if (idContacto) {
            query += ` AND f.id_contacto = $${paramIndex++}`;
            params.push(idContacto);
        }

        if (idCategoria) {
            query += ` AND f.id_categoria = $${paramIndex++}`;
            params.push(idCategoria);
        }

        if (idSucursal) {
            query += ` AND f.id_sucursal = $${paramIndex++}`;
            params.push(idSucursal);
        }

        if (search) {
            query += ` AND (
                f.numero_factura ILIKE $${paramIndex} OR 
                c.nombre ILIKE $${paramIndex} OR
                c.nif_cif ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY f.fecha_devengo DESC, f.created_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM contabilidad_factura f
            WHERE f.id_tenant = $1 AND f.deleted_at IS NULL
        `;
        const countParams = [tenantId];
        // Add same filters for count (simplified)
        if (tipo) {
            countQuery += ` AND f.tipo = $2`;
            countParams.push(tipo);
        }

        const countResult = await pool.query(countQuery, countParams);

        return {
            items: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset
        };
    }

    /**
     * Obtiene factura por ID
     */
    async getFacturaById(tenantId, id) {
        const result = await pool.query(`
            SELECT 
                f.*,
                c.nombre as contacto_nombre,
                c.nif_cif as contacto_nif,
                c.email as contacto_email,
                c.telefono as contacto_telefono,
                c.direccion as contacto_direccion,
                cat.nombre as categoria_nombre,
                cat.codigo as categoria_codigo,
                s.nombre as sucursal_nombre
            FROM contabilidad_factura f
            LEFT JOIN contabilidad_contacto c ON f.id_contacto = c.id
            LEFT JOIN contable_category cat ON f.id_categoria = cat.id
            LEFT JOIN sucursal s ON f.id_sucursal = s.id
            WHERE f.id = $1 AND f.id_tenant = $2 AND f.deleted_at IS NULL
        `, [id, tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Crea factura
     */
    async createFactura(tenantId, data, userId) {
        const {
            tipo,
            id_contacto,
            id_sucursal,
            numero_factura,
            fecha_emision,
            fecha_devengo,
            fecha_vencimiento,
            moneda = 'EUR',
            base_imponible,
            iva_porcentaje,
            iva_importe,
            total,
            id_categoria,
            notas
        } = data;

        const result = await pool.query(`
            INSERT INTO contabilidad_factura (
                id_tenant, tipo, id_contacto, id_sucursal, numero_factura,
                fecha_emision, fecha_devengo, fecha_vencimiento, moneda,
                base_imponible, iva_porcentaje, iva_importe, total,
                id_categoria, notas, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            ) RETURNING *
        `, [
            tenantId, tipo, id_contacto, id_sucursal, numero_factura,
            fecha_emision, fecha_devengo, fecha_vencimiento, moneda,
            base_imponible, iva_porcentaje, iva_importe, total,
            id_categoria, notas, userId
        ]);

        return result.rows[0];
    }

    /**
     * Actualiza factura
     */
    async updateFactura(tenantId, id, data, userId) {
        const allowedFields = [
            'tipo', 'id_contacto', 'id_sucursal', 'numero_factura',
            'fecha_emision', 'fecha_devengo', 'fecha_vencimiento',
            'base_imponible', 'iva_porcentaje', 'iva_importe', 'total',
            'estado', 'id_categoria', 'notas'
        ];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(data[field]);
            }
        }

        if (updates.length === 0) {
            return this.getFacturaById(tenantId, id);
        }

        updates.push(`updated_at = now()`);
        updates.push(`updated_by = $${paramIndex++}`);
        values.push(userId);

        values.push(id, tenantId);

        const result = await pool.query(`
            UPDATE contabilidad_factura
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex++} AND id_tenant = $${paramIndex++} AND deleted_at IS NULL
            RETURNING *
        `, values);

        return result.rows[0];
    }

    /**
     * Soft delete factura
     */
    async deleteFactura(tenantId, id, userId) {
        const result = await pool.query(`
            UPDATE contabilidad_factura
            SET deleted_at = now(), updated_by = $3
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
            RETURNING id
        `, [id, tenantId, userId]);

        return result.rowCount > 0;
    }

    // ===================================================================
    // ARCHIVOS
    // ===================================================================

    async createArchivo(facturaId, data, userId) {
        const result = await pool.query(`
            INSERT INTO contabilidad_factura_archivo (
                id_factura, file_url, storage_key, mime_type, 
                size_bytes, original_name, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            facturaId, data.file_url, data.storage_key,
            data.mime_type, data.size_bytes, data.original_name, userId
        ]);

        return result.rows[0];
    }

    async listArchivosByFactura(facturaId) {
        const result = await pool.query(`
            SELECT * FROM contabilidad_factura_archivo
            WHERE id_factura = $1
            ORDER BY created_at DESC
        `, [facturaId]);

        return result.rows;
    }

    // ===================================================================
    // PAGOS
    // ===================================================================

    async createPago(facturaId, data, userId) {
        const result = await pool.query(`
            INSERT INTO contabilidad_pago (
                id_factura, fecha_pago, importe, metodo, referencia, notas, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            facturaId, data.fecha_pago, data.importe,
            data.metodo, data.referencia, data.notas, userId
        ]);

        return result.rows[0];
    }

    async listPagosByFactura(facturaId) {
        const result = await pool.query(`
            SELECT p.*, u.nombre as created_by_nombre
            FROM contabilidad_pago p
            LEFT JOIN usuario u ON p.created_by = u.id
            WHERE p.id_factura = $1
            ORDER BY p.fecha_pago DESC
        `, [facturaId]);

        return result.rows;
    }

    async deletePago(pagoId) {
        const result = await pool.query(`
            DELETE FROM contabilidad_pago WHERE id = $1
            RETURNING id_factura
        `, [pagoId]);

        return result.rows[0];
    }

    // ===================================================================
    // CONTACTOS
    // ===================================================================

    async listContactos(tenantId, filters = {}) {
        const { tipo, activo = true, search, limit = 100, offset = 0 } = filters;

        let query = `
            SELECT * FROM contabilidad_contacto
            WHERE id_tenant = $1 AND deleted_at IS NULL
        `;
        const params = [tenantId];
        let paramIndex = 2;

        if (activo !== null) {
            query += ` AND activo = $${paramIndex++}`;
            params.push(activo);
        }

        if (tipo) {
            query += ` AND tipo = $${paramIndex++}`;
            params.push(tipo);
        }

        if (search) {
            query += ` AND (nombre ILIKE $${paramIndex} OR nif_cif ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY nombre ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    }

    async getContactoById(tenantId, id) {
        const result = await pool.query(`
            SELECT * FROM contabilidad_contacto
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
        `, [id, tenantId]);

        return result.rows[0] || null;
    }

    async createContacto(tenantId, data, userId) {
        const result = await pool.query(`
            INSERT INTO contabilidad_contacto (
                id_tenant, tipo, nombre, nif_cif, email, telefono,
                direccion, codigo_postal, ciudad, provincia, pais, notas, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            tenantId, data.tipo, data.nombre, data.nif_cif,
            data.email, data.telefono, data.direccion,
            data.codigo_postal, data.ciudad, data.provincia,
            data.pais || 'ES', data.notas, userId
        ]);

        return result.rows[0];
    }

    async updateContacto(tenantId, id, data, userId) {
        const allowedFields = [
            'tipo', 'nombre', 'nif_cif', 'email', 'telefono',
            'direccion', 'codigo_postal', 'ciudad', 'provincia',
            'pais', 'activo', 'notas'
        ];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(data[field]);
            }
        }

        if (updates.length === 0) {
            return this.getContactoById(tenantId, id);
        }

        updates.push(`updated_at = now()`);
        updates.push(`updated_by = $${paramIndex++}`);
        values.push(userId);
        values.push(id, tenantId);

        const result = await pool.query(`
            UPDATE contabilidad_contacto
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex++} AND id_tenant = $${paramIndex++} AND deleted_at IS NULL
            RETURNING *
        `, values);

        return result.rows[0];
    }

    async deleteContacto(tenantId, id, userId) {
        const result = await pool.query(`
            UPDATE contabilidad_contacto
            SET deleted_at = now(), updated_by = $3
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
            RETURNING id
        `, [id, tenantId, userId]);

        return result.rowCount > 0;
    }

    // ===================================================================
    // TRIMESTRES
    // ===================================================================

    async listTrimestres(tenantId, filters = {}) {
        const { anio } = filters;

        let query = `
            SELECT * FROM contabilidad_trimestre
            WHERE id_tenant = $1
        `;
        const params = [tenantId];

        if (anio) {
            query += ` AND anio = $2`;
            params.push(anio);
        }

        query += ` ORDER BY anio DESC, trimestre DESC`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    async getTrimestreByPeriod(tenantId, anio, trimestre) {
        const result = await pool.query(`
            SELECT * FROM contabilidad_trimestre
            WHERE id_tenant = $1 AND anio = $2 AND trimestre = $3
        `, [tenantId, anio, trimestre]);

        return result.rows[0] || null;
    }

    async createOrUpdateTrimestre(tenantId, anio, trimestre, data, userId) {
        const result = await pool.query(`
            INSERT INTO contabilidad_trimestre (
                id_tenant, anio, trimestre, estado,
                base_ingresos, iva_repercutido, base_gastos, iva_soportado,
                resultado_iva, closed_at, closed_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id_tenant, anio, trimestre) DO UPDATE SET
                estado = EXCLUDED.estado,
                base_ingresos = EXCLUDED.base_ingresos,
                iva_repercutido = EXCLUDED.iva_repercutido,
                base_gastos = EXCLUDED.base_gastos,
                iva_soportado = EXCLUDED.iva_soportado,
                resultado_iva = EXCLUDED.resultado_iva,
                closed_at = EXCLUDED.closed_at,
                closed_by = EXCLUDED.closed_by
            RETURNING *
        `, [
            tenantId, anio, trimestre, data.estado,
            data.base_ingresos, data.iva_repercutido,
            data.base_gastos, data.iva_soportado,
            data.resultado_iva,
            data.estado === 'CERRADO' ? new Date() : null,
            data.estado === 'CERRADO' ? userId : null
        ]);

        return result.rows[0];
    }

    async reabrirTrimestre(tenantId, anio, trimestre, reason, userId) {
        const result = await pool.query(`
            UPDATE contabilidad_trimestre
            SET estado = 'REABIERTO', 
                reopened_at = now(), 
                reopened_by = $4,
                reopen_reason = $5
            WHERE id_tenant = $1 AND anio = $2 AND trimestre = $3
            RETURNING *
        `, [tenantId, anio, trimestre, userId, reason]);

        return result.rows[0];
    }

    // ===================================================================
    // CATEGORÍAS
    // ===================================================================

    async listCategorias(tenantId, filters = {}) {
        const { tipo, activo = true } = filters;

        let query = `
            SELECT * FROM contable_category
            WHERE id_tenant = $1
        `;
        const params = [tenantId];
        let paramIndex = 2;

        if (activo !== null) {
            query += ` AND activo = $${paramIndex++}`;
            params.push(activo);
        }

        if (tipo) {
            query += ` AND tipo = $${paramIndex++}`;
            params.push(tipo);
        }

        query += ` ORDER BY tipo, nombre`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    async createCategoria(tenantId, data, userId) {
        const result = await pool.query(`
            INSERT INTO contable_category (
                id_tenant, codigo, nombre, tipo, descripcion, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [tenantId, data.codigo, data.nombre, data.tipo, data.descripcion, userId]);

        return result.rows[0];
    }

    async updateCategoria(tenantId, id, data) {
        const result = await pool.query(`
            UPDATE contable_category
            SET nombre = COALESCE($3, nombre),
                descripcion = COALESCE($4, descripcion),
                activo = COALESCE($5, activo)
            WHERE id = $1 AND id_tenant = $2
            RETURNING *
        `, [id, tenantId, data.nombre, data.descripcion, data.activo]);

        return result.rows[0];
    }

    async deleteCategoria(tenantId, id) {
        const result = await pool.query(`
            UPDATE contable_category
            SET activo = false
            WHERE id = $1 AND id_tenant = $2
            RETURNING id
        `, [id, tenantId]);

        return result.rowCount > 0;
    }

    // ===================================================================
    // DASHBOARD / REPORTS
    // ===================================================================

    /**
     * Obtiene resumen IVA por período
     */
    async getResumenIVA(tenantId, anio, trimestre) {
        const fechaInicio = new Date(anio, (trimestre - 1) * 3, 1);
        const fechaFin = new Date(anio, trimestre * 3, 0);

        const result = await pool.query(`
            SELECT 
                tipo,
                COUNT(*) as cantidad,
                COALESCE(SUM(base_imponible), 0) as base_total,
                COALESCE(SUM(iva_importe), 0) as iva_total,
                COALESCE(SUM(total), 0) as total_total
            FROM contabilidad_factura
            WHERE id_tenant = $1 
              AND fecha_devengo >= $2 
              AND fecha_devengo <= $3
              AND deleted_at IS NULL
              AND estado != 'ANULADA'
            GROUP BY tipo
        `, [tenantId, fechaInicio, fechaFin]);

        let ingresos = { cantidad: 0, base: 0, iva: 0, total: 0 };
        let gastos = { cantidad: 0, base: 0, iva: 0, total: 0 };

        for (const row of result.rows) {
            const data = {
                cantidad: parseInt(row.cantidad),
                base: parseFloat(row.base_total),
                iva: parseFloat(row.iva_total),
                total: parseFloat(row.total_total)
            };

            if (row.tipo === 'INGRESO') ingresos = data;
            else if (row.tipo === 'GASTO') gastos = data;
        }

        return {
            anio,
            trimestre,
            fechaInicio,
            fechaFin,
            ingresos,
            gastos,
            iva_repercutido: ingresos.iva,
            iva_soportado: gastos.iva,
            resultado: ingresos.iva - gastos.iva
        };
    }

    /**
     * Obtiene KPIs del dashboard
     */
    async getDashboardKPIs(tenantId, anio, trimestre) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const mesInicio = new Date(currentYear, currentMonth, 1);
        const mesFin = new Date(currentYear, currentMonth + 1, 0);

        // IVA del trimestre
        const ivaResumen = await this.getResumenIVA(tenantId, anio, trimestre);

        // Pendiente por cobrar (ingresos pendientes)
        const pendienteCobrar = await pool.query(`
            SELECT COALESCE(SUM(total - total_pagado), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'INGRESO' 
              AND estado IN ('PENDIENTE', 'PARCIAL') 
              AND deleted_at IS NULL
        `, [tenantId]);

        // Pendiente por pagar (gastos pendientes)
        const pendientePagar = await pool.query(`
            SELECT COALESCE(SUM(total - total_pagado), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'GASTO' 
              AND estado IN ('PENDIENTE', 'PARCIAL') 
              AND deleted_at IS NULL
        `, [tenantId]);

        // Facturas vencidas
        const vencidas = await pool.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(total - total_pagado), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 
              AND fecha_vencimiento < CURRENT_DATE
              AND estado IN ('PENDIENTE', 'PARCIAL')
              AND deleted_at IS NULL
        `, [tenantId]);

        // Gasto mensual (mes actual)
        const gastoMensual = await pool.query(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'GASTO'
              AND fecha_devengo >= $2 AND fecha_devengo <= $3
              AND deleted_at IS NULL
        `, [tenantId, mesInicio, mesFin]);

        return {
            iva_trimestre: {
                resultado: ivaResumen.resultado,
                repercutido: ivaResumen.iva_repercutido,
                soportado: ivaResumen.iva_soportado
            },
            pendiente_cobrar: parseFloat(pendienteCobrar.rows[0].total),
            pendiente_pagar: parseFloat(pendientePagar.rows[0].total),
            vencidas: {
                count: parseInt(vencidas.rows[0].count),
                total: parseFloat(vencidas.rows[0].total)
            },
            gasto_mensual: parseFloat(gastoMensual.rows[0].total)
        };
    }

    /**
     * Gastos por categoría
     */
    async getGastosPorCategoria(tenantId, fechaDesde, fechaHasta) {
        const result = await pool.query(`
            SELECT 
                cat.id,
                cat.codigo,
                cat.nombre,
                COUNT(f.id) as cantidad,
                COALESCE(SUM(f.total), 0) as total
            FROM contable_category cat
            LEFT JOIN contabilidad_factura f ON f.id_categoria = cat.id 
                AND f.tipo = 'GASTO'
                AND f.deleted_at IS NULL
                AND f.fecha_devengo >= $2
                AND f.fecha_devengo <= $3
            WHERE cat.id_tenant = $1 AND cat.tipo = 'GASTO' AND cat.activo = true
            GROUP BY cat.id, cat.codigo, cat.nombre
            ORDER BY total DESC
        `, [tenantId, fechaDesde, fechaHasta]);

        return result.rows;
    }
}

module.exports = new ContabilidadRepository();
