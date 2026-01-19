/**
 * Contabilidad Repository
 * Acceso a datos para el módulo de contabilidad
 * Todas las queries usan tenant context obligatorio
 */

const { getTenantDb } = require('../../../../core/db/tenant-db');

class ContabilidadRepository {
    // ===================================================================
    // FACTURAS
    // ===================================================================

    /**
     * Lista facturas con filtros
     */
    async listFacturas(ctx, filters = {}) {
        const db = getTenantDb(ctx);
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

        // Base query
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
        const params = [ctx.tenantId];
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

        if (filters.idEmpresa) {
            query += ` AND f.id_empresa = $${paramIndex++}`;
            params.push(filters.idEmpresa);
        }

        // Filtro de estado deducible (nuevo)
        // Filtro de estado deducible (nuevo)
        if (filters.deducible_status) {
            if (filters.deducible_status === 'validated') {
                // Special filter: show validated (not pending)
                query += ` AND f.deducible_status IN ('deducible', 'no_deducible')`;
            } else if (filters.deducible_status === 'pending') {
                // Pending includes explicit 'pending' OR NULL
                query += ` AND (f.deducible_status = 'pending' OR f.deducible_status IS NULL)`;
            } else {
                query += ` AND f.deducible_status = $${paramIndex++}`;
                params.push(filters.deducible_status);
            }
        }

        query += ` ORDER BY f.fecha_devengo DESC, f.created_at DESC`;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM contabilidad_factura f
        `;

        // Add joins if search is present (since search uses contact name/nif)
        if (search) {
            countQuery += ` LEFT JOIN contabilidad_contacto c ON f.id_contacto = c.id`;
        }

        countQuery += ` WHERE f.id_tenant = $1 AND f.deleted_at IS NULL`;

        const countParams = [ctx.tenantId];
        let countParamIndex = 2;

        if (tipo) {
            countQuery += ` AND f.tipo = $${countParamIndex++}`;
            countParams.push(tipo);
        }

        if (estado) {
            countQuery += ` AND f.estado = $${countParamIndex++}`;
            countParams.push(estado);
        }

        if (fechaDesde) {
            countQuery += ` AND f.fecha_devengo >= $${countParamIndex++}`;
            countParams.push(fechaDesde);
        }

        if (fechaHasta) {
            countQuery += ` AND f.fecha_devengo <= $${countParamIndex++}`;
            countParams.push(fechaHasta);
        }

        if (trimestre && anio) {
            countQuery += ` AND EXTRACT(QUARTER FROM f.fecha_devengo) = $${countParamIndex++}`;
            countParams.push(trimestre);
            countQuery += ` AND EXTRACT(YEAR FROM f.fecha_devengo) = $${countParamIndex++}`;
            countParams.push(anio);
        }

        if (idContacto) {
            countQuery += ` AND f.id_contacto = $${countParamIndex++}`;
            countParams.push(idContacto);
        }

        if (idCategoria) {
            countQuery += ` AND f.id_categoria = $${countParamIndex++}`;
            countParams.push(idCategoria);
        }

        if (idSucursal) {
            countQuery += ` AND f.id_sucursal = $${countParamIndex++}`;
            countParams.push(idSucursal);
        }

        if (filters.deducible_status) {
            if (filters.deducible_status === 'validated') {
                countQuery += ` AND f.deducible_status IN ('deducible', 'no_deducible')`;
            } else if (filters.deducible_status === 'pending') {
                countQuery += ` AND (f.deducible_status = 'pending' OR f.deducible_status IS NULL)`;
            } else {
                countQuery += ` AND f.deducible_status = $${countParamIndex++}`;
                countParams.push(filters.deducible_status);
            }
        }

        if (filters.idEmpresa) {
            countQuery += ` AND f.id_empresa = $${countParamIndex++}`;
            countParams.push(filters.idEmpresa);
        }

        if (search) {
            countQuery += ` AND (
                f.numero_factura ILIKE $${countParamIndex} OR 
                c.nombre ILIKE $${countParamIndex} OR
                c.nif_cif ILIKE $${countParamIndex}
            )`;
            countParams.push(`%${search}%`);
            countParamIndex++;
        }

        const countResult = await db.query(countQuery, countParams);

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
    async getFacturaById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
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
        `, [id, ctx.tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Crea factura
     */
    async createFactura(ctx, data) {
        const db = getTenantDb(ctx);
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
            retencion_porcentaje = 0,
            retencion_importe = 0,
            total,
            id_categoria,
            notas,
            id_empresa
        } = data;

        const result = await db.query(`
            INSERT INTO contabilidad_factura (
                id_tenant, id_empresa, tipo, id_contacto, id_sucursal, numero_factura,
                fecha_emision, fecha_devengo, fecha_vencimiento, moneda,
                base_imponible, iva_porcentaje, iva_importe, 
                retencion_porcentaje, retencion_importe, total,
                id_categoria, notas, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) RETURNING *
        `, [
            ctx.tenantId, id_empresa, tipo, id_contacto, id_sucursal, numero_factura,
            fecha_emision, fecha_devengo, fecha_vencimiento, moneda,
            base_imponible, iva_porcentaje, iva_importe,
            retencion_porcentaje, retencion_importe, total,
            id_categoria, notas, ctx.userId
        ]);

        return result.rows[0];
    }

    /**
     * Actualiza factura
     */
    async updateFactura(ctx, id, data) {
        const db = getTenantDb(ctx);
        const allowedFields = [
            'tipo', 'id_contacto', 'id_sucursal', 'numero_factura',
            'fecha_emision', 'fecha_devengo', 'fecha_vencimiento',
            'base_imponible', 'iva_porcentaje', 'iva_importe',
            'retencion_porcentaje', 'retencion_importe', 'total',
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
            return this.getFacturaById(ctx, id);
        }

        updates.push(`updated_at = now()`);
        updates.push(`updated_by = $${paramIndex++}`);
        values.push(ctx.userId);

        values.push(id, ctx.tenantId);

        const result = await db.query(`
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
    async deleteFactura(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            UPDATE contabilidad_factura
            SET deleted_at = now(), updated_by = $3
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
            RETURNING id
        `, [id, ctx.tenantId, ctx.userId]);

        return result.rowCount > 0;
    }

    // ===================================================================
    // ARCHIVOS
    // ===================================================================

    async createArchivo(ctx, facturaId, data) {
        const db = getTenantDb(ctx);
        // Obtenemos el id_empresa de la factura si no viene en data
        let empresaId = data.id_empresa;
        if (!empresaId) {
            const fact = await db.query('SELECT id_empresa FROM contabilidad_factura WHERE id = $1', [facturaId]);
            if (fact.rows.length > 0) empresaId = fact.rows[0].id_empresa;
        }

        const result = await db.query(`
            INSERT INTO contabilidad_factura_archivo (
                id_factura, id_empresa, file_url, storage_key, mime_type, 
                size_bytes, original_name, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            facturaId, empresaId, data.file_url, data.storage_key,
            data.mime_type, data.size_bytes, data.original_name, ctx.userId
        ]);

        return result.rows[0];
    }

    async listArchivosByFactura(ctx, facturaId) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT * FROM contabilidad_factura_archivo
            WHERE id_factura = $1
            ORDER BY created_at DESC
        `, [facturaId]);

        return result.rows;
    }

    // ===================================================================
    // PAGOS
    // ===================================================================

    async createPago(ctx, facturaId, data) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            INSERT INTO contabilidad_pago (
                id_factura, fecha_pago, importe, metodo, referencia, notas, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            facturaId, data.fecha_pago, data.importe,
            data.metodo, data.referencia, data.notas, ctx.userId
        ]);

        return result.rows[0];
    }

    async listPagosByFactura(ctx, facturaId) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT p.*, u.nombre as created_by_nombre
            FROM contabilidad_pago p
            LEFT JOIN usuario u ON p.created_by = u.id
            WHERE p.id_factura = $1
            ORDER BY p.fecha_pago DESC
        `, [facturaId]);

        return result.rows;
    }

    async deletePago(ctx, pagoId) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            DELETE FROM contabilidad_pago WHERE id = $1
            RETURNING id_factura
        `, [pagoId]);

        return result.rows[0];
    }

    // ===================================================================
    // CONTACTOS
    // ===================================================================

    async listContactos(ctx, filters = {}) {
        const db = getTenantDb(ctx);
        const { tipo, activo = true, search, limit = 100, offset = 0 } = filters;

        let query = `
            SELECT c.*, e.nombre_legal as empresa_nombre 
            FROM contabilidad_contacto c
            LEFT JOIN accounting_empresa e ON e.id = c.id_empresa
            WHERE c.id_tenant = $1 AND c.deleted_at IS NULL
        `;
        const params = [ctx.tenantId];
        let paramIndex = 2;

        if (activo !== null) {
            query += ` AND c.activo = $${paramIndex++}`;
            params.push(activo);
        }

        if (tipo) {
            query += ` AND c.tipo = $${paramIndex++}`;
            params.push(tipo);
        }

        if (search) {
            query += ` AND (c.nombre ILIKE $${paramIndex} OR c.nif_cif ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (filters.idEmpresa) {
            query += ` AND c.id_empresa = $${paramIndex++}`;
            params.push(filters.idEmpresa);
        }

        query += ` ORDER BY c.nombre ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return result.rows;
    }

    async getContactoById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT * FROM contabilidad_contacto
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
        `, [id, ctx.tenantId]);

        return result.rows[0] || null;
    }

    /**
     * Find contact by NIF/CIF within tenant
     */
    async findContactoByNif(ctx, nifCif) {
        if (!nifCif) return null;

        const db = getTenantDb(ctx);
        const normalizedNif = nifCif.trim().toUpperCase();

        const result = await db.query(`
            SELECT * FROM contabilidad_contacto
            WHERE id_tenant = $1 
              AND UPPER(TRIM(nif_cif)) = $2
              AND deleted_at IS NULL
              AND activo = true
            LIMIT 1
        `, [ctx.tenantId, normalizedNif]);

        return result.rows[0] || null;
    }

    async createContacto(ctx, data) {
        const db = getTenantDb(ctx);

        // Check for duplicate NIF/CIF
        if (data.nif_cif) {
            const existing = await this.findContactoByNif(ctx, data.nif_cif);
            if (existing) {
                const error = new Error(`Ya existe un contacto con NIF/CIF ${data.nif_cif.toUpperCase()}`);
                error.code = 'DUPLICATE_NIF';
                error.existingContact = existing;
                throw error;
            }
        }

        const result = await db.query(`
            INSERT INTO contabilidad_contacto (
                id_tenant, id_empresa, tipo, nombre, nif_cif, email, telefono,
                direccion, codigo_postal, ciudad, provincia, pais, 
                condiciones_pago, iban, notas, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            ctx.tenantId, data.id_empresa, data.tipo, data.nombre, data.nif_cif?.trim().toUpperCase(),
            data.email, data.telefono, data.direccion,
            data.codigo_postal, data.ciudad, data.provincia,
            data.pais || 'ES', data.condiciones_pago, data.iban,
            data.notas, ctx.userId
        ]);

        return result.rows[0];
    }

    async updateContacto(ctx, id, data) {
        const db = getTenantDb(ctx);
        const allowedFields = [
            'tipo', 'nombre', 'nif_cif', 'email', 'telefono',
            'direccion', 'codigo_postal', 'ciudad', 'provincia',
            'pais', 'condiciones_pago', 'iban', 'activo', 'notas'
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
            return this.getContactoById(ctx, id);
        }

        updates.push(`updated_at = now()`);
        updates.push(`updated_by = $${paramIndex++}`);
        values.push(ctx.userId);
        values.push(id, ctx.tenantId);

        const result = await db.query(`
            UPDATE contabilidad_contacto
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex++} AND id_tenant = $${paramIndex++} AND deleted_at IS NULL
            RETURNING *
        `, values);

        return result.rows[0];
    }

    async deleteContacto(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            UPDATE contabilidad_contacto
            SET deleted_at = now(), updated_by = $3
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
            RETURNING id
        `, [id, ctx.tenantId, ctx.userId]);

        return result.rowCount > 0;
    }

    // ===================================================================
    // TRIMESTRES
    // ===================================================================

    async listTrimestres(ctx, filters = {}) {
        const db = getTenantDb(ctx);
        const { anio } = filters;

        // Base query
        let query = `
            SELECT * FROM contabilidad_trimestre
            WHERE id_tenant = $1
        `;
        const params = [ctx.tenantId];
        let paramIndex = 2;

        if (anio) {
            query += ` AND anio = $${paramIndex++}`;
            params.push(anio);
        }

        query += ` ORDER BY anio DESC, trimestre DESC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async getTrimestreByPeriod(ctx, anio, trimestre) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            SELECT * FROM contabilidad_trimestre
            WHERE id_tenant = $1 AND anio = $2 AND trimestre = $3
        `, [ctx.tenantId, anio, trimestre]);

        return result.rows[0] || null;
    }

    async createOrUpdateTrimestre(ctx, anio, trimestre, data) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
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
            ctx.tenantId, anio, trimestre, data.estado,
            data.base_ingresos, data.iva_repercutido,
            data.base_gastos, data.iva_soportado,
            data.resultado_iva,
            data.estado === 'CERRADO' ? new Date() : null,
            data.estado === 'CERRADO' ? ctx.userId : null
        ]);

        return result.rows[0];
    }

    async reabrirTrimestre(ctx, anio, trimestre, reason) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            UPDATE contabilidad_trimestre
            SET estado = 'REABIERTO', 
                reopened_at = now(), 
                reopened_by = $4,
                reopen_reason = $5
            WHERE id_tenant = $1 AND anio = $2 AND trimestre = $3
            RETURNING *
        `, [ctx.tenantId, anio, trimestre, ctx.userId, reason]);

        return result.rows[0];
    }

    // ===================================================================
    // CATEGORÍAS
    // ===================================================================

    async listCategorias(ctx, filters = {}) {
        const db = getTenantDb(ctx);
        const { tipo, activo = true } = filters;

        let query = `
            SELECT * FROM contable_category
            WHERE id_tenant = $1
        `;
        const params = [ctx.tenantId];
        let paramIndex = 2;

        if (activo !== null) {
            query += ` AND activo = $${paramIndex++}`;
            params.push(activo);
        }

        if (tipo) {
            query += ` AND tipo = $${paramIndex++}`;
            params.push(tipo);
        }

        if (filters.idEmpresa) {
            query += ` AND id_empresa = $${paramIndex++}`;
            params.push(filters.idEmpresa);
        }

        query += ` ORDER BY tipo, nombre`;

        const result = await db.query(query, params);
        return result.rows;
    }

    async createCategoria(ctx, data) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            INSERT INTO contable_category (
                id_tenant, id_empresa, codigo, nombre, tipo, descripcion, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [ctx.tenantId, data.id_empresa, data.codigo, data.nombre, data.tipo, data.descripcion, ctx.userId]);

        return result.rows[0];
    }

    async updateCategoria(ctx, id, data) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            UPDATE contable_category
            SET nombre = COALESCE($3, nombre),
                descripcion = COALESCE($4, descripcion),
                activo = COALESCE($5, activo)
            WHERE id = $1 AND id_tenant = $2
            RETURNING *
        `, [id, ctx.tenantId, data.nombre, data.descripcion, data.activo]);

        return result.rows[0];
    }

    async deleteCategoria(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(`
            UPDATE contable_category
            SET activo = false
            WHERE id = $1 AND id_tenant = $2
            RETURNING id
        `, [id, ctx.tenantId]);

        return result.rowCount > 0;
    }

    // ===================================================================
    // DASHBOARD / REPORTS
    // ===================================================================

    /**
     * Obtiene resumen IVA por período
     */
    async getResumenIVA(ctx, empresaId, anio, trimestre) {
        const db = getTenantDb(ctx);
        const fechaInicio = new Date(anio, (trimestre - 1) * 3, 1);
        const fechaFin = new Date(anio, trimestre * 3, 0);

        let query = `
            SELECT 
                tipo,
                COUNT(*) as cantidad,
                COALESCE(SUM(base_imponible), 0) as base_total,
                COALESCE(SUM(iva_importe), 0) as iva_total,
                COALESCE(SUM(retencion_importe), 0) as retencion_total,
                COALESCE(SUM(total), 0) as total_total
            FROM contabilidad_factura
            WHERE id_tenant = $1 
              AND fecha_devengo >= $2 
              AND fecha_devengo <= $3
              AND deleted_at IS NULL
              AND estado != 'ANULADA'
        `;
        const params = [ctx.tenantId, fechaInicio, fechaFin];

        if (empresaId) {
            query += ` AND id_empresa = $4`;
            params.push(empresaId);
        }

        query += ` GROUP BY tipo`;

        const result = await db.query(query, params);

        let ingresos = { cantidad: 0, base: 0, iva: 0, retenciones: 0, total: 0 };
        let gastos = { cantidad: 0, base: 0, iva: 0, retenciones: 0, total: 0 };

        for (const row of result.rows) {
            const data = {
                cantidad: parseInt(row.cantidad),
                base: parseFloat(row.base_total),
                iva: parseFloat(row.iva_total),
                retenciones: parseFloat(row.retencion_total),
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
            retenciones_ingresos: ingresos.retenciones,
            retenciones_gastos: gastos.retenciones,
            resultado: ingresos.iva - gastos.iva,
            resultado_retenciones: ingresos.retenciones - gastos.retenciones
        };
    }

    /**
     * Obtiene KPIs del dashboard por empresa
     */
    async getDashboardKPIs(ctx, empresaId, anio, trimestre) {
        const db = getTenantDb(ctx);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const mesInicio = new Date(currentYear, currentMonth, 1);
        const mesFin = new Date(currentYear, currentMonth + 1, 0);

        // IVA del trimestre
        const ivaResumen = await this.getResumenIVA(ctx, empresaId, anio, trimestre);

        // Build empresa filter
        const empresaFilter = empresaId ? ' AND id_empresa = $2' : '';
        const empresaParams = empresaId ? [ctx.tenantId, empresaId] : [ctx.tenantId];

        // Pendiente por cobrar (AR - Accounts Receivable)
        const pendienteCobrar = await db.query(`
            SELECT COALESCE(SUM(total - total_pagado), 0) as total,
                   COUNT(*) as count
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'INGRESO' 
              AND estado IN ('PENDIENTE', 'PARCIAL') 
              AND deleted_at IS NULL
              ${empresaFilter}
        `, empresaParams);

        // Pendiente por pagar (AP - Accounts Payable)
        const pendientePagar = await db.query(`
            SELECT COALESCE(SUM(total - total_pagado), 0) as total,
                   COUNT(*) as count
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'GASTO' 
              AND estado IN ('PENDIENTE', 'PARCIAL') 
              AND deleted_at IS NULL
              ${empresaFilter}
        `, empresaParams);

        // Facturas vencidas (AR + AP)
        const vencidas = await db.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(total - total_pagado), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 
              AND fecha_vencimiento < CURRENT_DATE
              AND estado IN ('PENDIENTE', 'PARCIAL')
              AND deleted_at IS NULL
              ${empresaFilter}
        `, empresaParams);

        // Ingreso mensual (mes actual)
        const ingresoMensual = await db.query(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'INGRESO'
              AND fecha_devengo >= $${empresaId ? 3 : 2} AND fecha_devengo <= $${empresaId ? 4 : 3}
              AND deleted_at IS NULL
              ${empresaFilter}
        `, empresaId ? [ctx.tenantId, empresaId, mesInicio, mesFin] : [ctx.tenantId, mesInicio, mesFin]);

        // Gasto mensual (mes actual)
        const gastoMensual = await db.query(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 AND tipo = 'GASTO'
              AND fecha_devengo >= $${empresaId ? 3 : 2} AND fecha_devengo <= $${empresaId ? 4 : 3}
              AND deleted_at IS NULL
              ${empresaFilter}
        `, empresaId ? [ctx.tenantId, empresaId, mesInicio, mesFin] : [ctx.tenantId, mesInicio, mesFin]);

        // Saldo de caja (cuentas de tesorería)
        let saldoCaja = 0;
        if (empresaId) {
            const cajaResult = await db.query(`
                SELECT COALESCE(SUM(saldo_actual), 0) as total
                FROM accounting_cuenta_tesoreria
                WHERE id_empresa = $1 AND activo = true
            `, [empresaId]);
            saldoCaja = parseFloat(cajaResult.rows[0].total);
        }

        return {
            iva_trimestre: {
                resultado: ivaResumen.resultado,
                repercutido: ivaResumen.iva_repercutido,
                soportado: ivaResumen.iva_soportado
            },
            pendiente_cobrar: {
                total: parseFloat(pendienteCobrar.rows[0].total),
                count: parseInt(pendienteCobrar.rows[0].count)
            },
            pendiente_pagar: {
                total: parseFloat(pendientePagar.rows[0].total),
                count: parseInt(pendientePagar.rows[0].count)
            },
            vencidas: {
                count: parseInt(vencidas.rows[0].count),
                total: parseFloat(vencidas.rows[0].total)
            },
            ingreso_mensual: parseFloat(ingresoMensual.rows[0].total),
            gasto_mensual: parseFloat(gastoMensual.rows[0].total),
            saldo_caja: saldoCaja,
            periodo: {
                mes: currentMonth + 1,
                anio: currentYear
            }
        };
    }

    /**
     * Gastos por categoría (filtrado por empresa)
     */
    async getGastosPorCategoria(ctx, empresaId, fechaDesde, fechaHasta) {
        const db = getTenantDb(ctx);
        let query = `
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
        `;
        const params = [ctx.tenantId, fechaDesde, fechaHasta];

        if (empresaId) {
            query += ` AND f.id_empresa = $4`;
            params.push(empresaId);
        }

        query += ` WHERE cat.id_tenant = $1 AND cat.activo = true AND cat.tipo = 'GASTO'
                   GROUP BY cat.id, cat.codigo, cat.nombre
                   ORDER BY total DESC`;

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * Obtiene evolución de ingresos y gastos (últimos 6 meses)
     */
    async getEvolucionFinanciera(ctx, empresaId) {
        const db = getTenantDb(ctx);
        const query = `
            SELECT 
                TO_CHAR(fecha_devengo, 'Month') as mes_nombre,
                TO_CHAR(fecha_devengo, 'YYYY-MM') as mes,
                tipo,
                COALESCE(SUM(total), 0) as total
            FROM contabilidad_factura
            WHERE id_tenant = $1 
              AND id_empresa = $2
              AND fecha_devengo >= CURRENT_DATE - INTERVAL '6 months'
              AND deleted_at IS NULL
              AND estado != 'ANULADA'
            GROUP BY mes, mes_nombre, tipo
            ORDER BY mes ASC
        `;
        const result = await db.query(query, [ctx.tenantId, empresaId]);
        return result.rows;
    }
}

module.exports = new ContabilidadRepository();
