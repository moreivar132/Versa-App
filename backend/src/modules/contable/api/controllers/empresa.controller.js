/**
 * Empresa Controller
 * CRUD para empresas contables dentro del tenant
 */

const { getEffectiveTenant, isSuperAdmin } = require('../../../../../middleware/rbac');

/**
 * GET /api/contabilidad/empresas
 * Lista empresas del tenant (filtradas por permisos de usuario)
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ ok: false, error: 'Usuario no identificado' });
        }

        const isSuper = await isSuperAdmin(userId);
        const userRole = req.user?.rol || req.user?.role || '';
        const isAdmin = isSuper ||
            userRole.toLowerCase() === 'admin' ||
            userRole.toLowerCase() === 'administrador';

        console.log('[Empresas] List request:', { tenantId, userId, isSuperAdmin, userRole, isAdmin });

        let query;
        let params;

        // Para admins, mostrar TODAS las empresas del tenant (sin JOIN)
        if (isAdmin) {
            query = `
                SELECT e.*, 
                       (SELECT COUNT(*) FROM contabilidad_factura f WHERE f.id_empresa = e.id AND f.deleted_at IS NULL) as num_facturas,
                       (SELECT COUNT(*) FROM contabilidad_contacto c WHERE c.id_empresa = e.id AND c.deleted_at IS NULL) as num_contactos
                FROM accounting_empresa e
                WHERE e.id_tenant = $1 AND e.deleted_at IS NULL
                ORDER BY e.es_default DESC, e.nombre_legal ASC
            `;
            params = [tenantId];
        } else {
            // Usuario normal solo ve empresas asignadas
            query = `
                SELECT e.*, 
                       ue.rol_empresa,
                       (SELECT COUNT(*) FROM contabilidad_factura f WHERE f.id_empresa = e.id AND f.deleted_at IS NULL) as num_facturas,
                       (SELECT COUNT(*) FROM contabilidad_contacto c WHERE c.id_empresa = e.id AND c.deleted_at IS NULL) as num_contactos
                FROM accounting_empresa e
                JOIN accounting_usuario_empresa ue ON ue.id_empresa = e.id
                WHERE e.id_tenant = $1 
                  AND ue.id_usuario = $2
                  AND e.deleted_at IS NULL
                ORDER BY e.es_default DESC, e.nombre_legal ASC
            `;
            params = [tenantId, userId];
        }

        const result = await req.db.query(query, params);
        console.log('[Empresas] Found:', result.rows.length, 'empresas');

        res.json({
            ok: true,
            data: {
                items: result.rows,
                total: result.rows.length
            }
        });
    } catch (error) {
        console.error('Error en list empresas:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}


/**
 * GET /api/contabilidad/empresas/:id
 * Obtiene detalle de una empresa
 */
async function getById(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.params.id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const result = await req.db.query(`
            SELECT e.*,
                   (SELECT COUNT(*) FROM contabilidad_factura f WHERE f.id_empresa = e.id AND f.deleted_at IS NULL) as num_facturas,
                   (SELECT COUNT(*) FROM contabilidad_contacto c WHERE c.id_empresa = e.id AND c.deleted_at IS NULL) as num_contactos,
                   (SELECT COUNT(*) FROM accounting_usuario_empresa ue WHERE ue.id_empresa = e.id) as num_usuarios
            FROM accounting_empresa e
            WHERE e.id = $1 AND e.id_tenant = $2 AND e.deleted_at IS NULL
        `, [empresaId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });
        }

        // Obtener cuentas de tesorería
        const cuentas = await req.db.query(`
            SELECT * FROM accounting_cuenta_tesoreria
            WHERE id_empresa = $1 AND activo = true
            ORDER BY es_default DESC, nombre ASC
        `, [empresaId]);

        res.json({
            ok: true,
            data: {
                ...result.rows[0],
                cuentas_tesoreria: cuentas.rows
            }
        });
    } catch (error) {
        console.error('Error en getById empresa:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/contabilidad/empresas
 * Crea una nueva empresa contable
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const userId = req.user?.id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const {
            nombre_legal,
            nombre_comercial,
            nif_cif,
            direccion,
            codigo_postal,
            ciudad,
            provincia,
            pais = 'ES',
            moneda = 'EUR',
            iva_defecto = 21,
            regimen = 'GENERAL',
            email,
            telefono
        } = req.body;

        if (!nombre_legal || !nif_cif) {
            return res.status(400).json({
                ok: false,
                error: 'nombre_legal y nif_cif son obligatorios'
            });
        }

        await req.db.txWithRLS(async (tx) => {
            // Verificar si es la primera empresa (será default)
            const countResult = await tx.query(
                'SELECT COUNT(*) FROM accounting_empresa WHERE id_tenant = $1 AND deleted_at IS NULL',
                [tenantId]
            );
            const esDefault = parseInt(countResult.rows[0].count) === 0;

            // Crear empresa
            const result = await tx.query(`
                INSERT INTO accounting_empresa (
                    id_tenant, nombre_legal, nombre_comercial, nif_cif,
                    direccion, codigo_postal, ciudad, provincia, pais,
                    moneda, iva_defecto, regimen, email, telefono,
                    es_default, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `, [
                tenantId, nombre_legal, nombre_comercial, nif_cif,
                direccion, codigo_postal, ciudad, provincia, pais,
                moneda, iva_defecto, regimen, email, telefono,
                esDefault, userId
            ]);

            const empresa = result.rows[0];

            // Crear cuenta caja por defecto
            await tx.query(`
                INSERT INTO accounting_cuenta_tesoreria (id_empresa, nombre, tipo, es_default, created_by)
                VALUES ($1, 'Caja Principal', 'CAJA', true, $2)
            `, [empresa.id, userId]);

            // Asignar usuario creador como admin de la empresa
            await tx.query(`
                INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa, created_by)
                VALUES ($1, $2, 'empresa_admin', $1)
            `, [userId, empresa.id]);

            res.status(201).json({
                ok: true,
                data: empresa,
                message: 'Empresa creada correctamente'
            });
        });
    } catch (error) {
        console.error('Error en create empresa:', error);

        if (error.code === '23505') { // Unique violation
            return res.status(400).json({
                ok: false,
                error: 'Ya existe una empresa con ese NIF/CIF y Nombre Comercial en este tenant'
            });
        }

        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * PATCH /api/contabilidad/empresas/:id
 * Actualiza una empresa
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.params.id;
        const userId = req.user?.id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        // Verificar que la empresa pertenece al tenant
        const checkResult = await req.db.query(
            'SELECT id FROM accounting_empresa WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL',
            [empresaId, tenantId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });
        }

        const allowedFields = [
            'nombre_legal', 'nombre_comercial', 'nif_cif', 'direccion',
            'codigo_postal', 'ciudad', 'provincia', 'pais', 'moneda',
            'iva_defecto', 'regimen', 'email', 'telefono', 'logo_url', 'activo'
        ];

        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramCount}`);
                values.push(req.body[field]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ ok: false, error: 'No hay campos para actualizar' });
        }

        updates.push(`updated_at = now()`);
        updates.push(`updated_by = $${paramCount}`);
        values.push(userId);
        paramCount++;

        values.push(empresaId);
        values.push(tenantId);

        const result = await req.db.query(`
            UPDATE accounting_empresa 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount - 1} AND id_tenant = $${paramCount}
            RETURNING *
        `, values);

        res.json({
            ok: true,
            data: result.rows[0],
            message: 'Empresa actualizada correctamente'
        });
    } catch (error) {
        console.error('Error en update empresa:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/contabilidad/empresas/:id
 * Soft delete de una empresa (solo si no tiene datos)
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.params.id;
        const userId = req.user?.id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        // Verificar que no sea la única empresa o la default
        const checkResult = await req.db.query(`
            SELECT id, es_default,
                   (SELECT COUNT(*) FROM contabilidad_factura WHERE id_empresa = $1 AND deleted_at IS NULL) as facturas,
                   (SELECT COUNT(*) FROM accounting_empresa WHERE id_tenant = $2 AND deleted_at IS NULL) as total_empresas
            FROM accounting_empresa 
            WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL
        `, [empresaId, tenantId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });
        }

        const empresa = checkResult.rows[0];

        if (parseInt(empresa.total_empresas) <= 1) {
            return res.status(400).json({
                ok: false,
                error: 'No se puede eliminar la única empresa del tenant'
            });
        }

        if (parseInt(empresa.facturas) > 0) {
            return res.status(400).json({
                ok: false,
                error: 'No se puede eliminar una empresa con facturas. Desactívela en su lugar.'
            });
        }

        // Soft delete
        await req.db.query(`
            UPDATE accounting_empresa 
            SET deleted_at = now(), updated_by = $3
            WHERE id = $1 AND id_tenant = $2
        `, [empresaId, tenantId, userId]);

        res.json({
            ok: true,
            message: 'Empresa eliminada correctamente'
        });
    } catch (error) {
        console.error('Error en remove empresa:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * GET /api/contabilidad/empresas/:id/usuarios
 * Lista usuarios asignados a la empresa
 */
async function listUsuarios(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.params.id;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const result = await req.db.query(`
            SELECT ue.*, u.nombre, u.email
            FROM accounting_usuario_empresa ue
            JOIN usuario u ON u.id = ue.id_usuario
            JOIN accounting_empresa e ON e.id = ue.id_empresa
            WHERE ue.id_empresa = $1 AND e.id_tenant = $2
            ORDER BY u.nombre
        `, [empresaId, tenantId]);

        res.json({
            ok: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error en listUsuarios:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * POST /api/contabilidad/empresas/:id/usuarios
 * Asigna un usuario a la empresa
 */
async function addUsuario(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.params.id;
        const { id_usuario, rol_empresa = 'empresa_lector' } = req.body;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        if (!id_usuario) {
            return res.status(400).json({ ok: false, error: 'id_usuario es obligatorio' });
        }

        // Verificar empresa pertenece al tenant
        const empresaCheck = await req.db.query(
            'SELECT id FROM accounting_empresa WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL',
            [empresaId, tenantId]
        );

        if (empresaCheck.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa no encontrada' });
        }

        const result = await req.db.query(`
            INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id_usuario, id_empresa) 
            DO UPDATE SET rol_empresa = $3
            RETURNING *
        `, [id_usuario, empresaId, rol_empresa, req.user?.id]);

        res.json({
            ok: true,
            data: result.rows[0],
            message: 'Usuario asignado correctamente'
        });
    } catch (error) {
        console.error('Error en addUsuario:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * DELETE /api/contabilidad/empresas/:id/usuarios/:userId
 * Elimina asignación de usuario a empresa
 */
async function removeUsuario(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        const empresaId = req.params.id;
        const userId = req.params.userId;

        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        await req.db.query(`
            DELETE FROM accounting_usuario_empresa
            WHERE id_empresa = $1 AND id_usuario = $2
            AND id_empresa IN (SELECT id FROM accounting_empresa WHERE id_tenant = $3)
        `, [empresaId, userId, tenantId]);

        res.json({
            ok: true,
            message: 'Asignación eliminada correctamente'
        });
    } catch (error) {
        console.error('Error en removeUsuario:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove,
    listUsuarios,
    addUsuario,
    removeUsuario
};
