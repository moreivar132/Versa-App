/**
 * Facturas Controller
 * CRUD de facturas contables
 */

const service = require('../../application/services/contabilidad.service');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auditService = require('../../../../core/logging/audit-service');
const { AUDIT_ACTIONS } = auditService;

// Configurar multer para uploads
// Configurar multer para uploads
const { getUploadPath } = require('../../../../core/config/storage');
const uploadDir = getUploadPath('contabilidad');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG.'));
        }
    }
}).single('archivo');

/**
 * GET /api/contabilidad/facturas
 */
async function list(req, res) {
    try {
        const ctx = req.ctx;
        if (!ctx?.tenantId) {
            return res.status(403).json({ ok: false, error: 'Contexto de tenant requerido', requestId: req.requestId });
        }

        const idEmpresa = req.headers['x-empresa-id'] || req.query.idEmpresa || ctx.empresaId;

        const filters = {
            tipo: req.query.tipo,
            estado: req.query.estado,
            fechaDesde: req.query.fechaDesde,
            fechaHasta: req.query.fechaHasta,
            trimestre: req.query.trimestre ? parseInt(req.query.trimestre) : null,
            anio: req.query.anio ? parseInt(req.query.anio) : null,
            idContacto: req.query.idContacto ? parseInt(req.query.idContacto) : null,
            idCategoria: req.query.idCategoria ? parseInt(req.query.idCategoria) : null,
            idSucursal: req.query.idSucursal ? parseInt(req.query.idSucursal) : null,
            deducible_status: req.query.deducible_status,
            search: req.query.search,
            idEmpresa: idEmpresa,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await service.listFacturas(ctx, filters);

        res.json({
            ok: true,
            ...result
        });
    } catch (error) {
        console.error('Error en list facturas:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message,
            requestId: req.requestId
        });
    }
}

/**
 * GET /api/contabilidad/facturas/:id
 */
async function getById(req, res) {
    try {
        const ctx = req.ctx;
        const id = parseInt(req.params.id);
        const factura = await service.getFactura(ctx, id);

        res.json({
            ok: true,
            data: factura
        });
    } catch (error) {
        console.error('Error en getById factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message,
            requestId: req.requestId
        });
    }
}

/**
 * POST /api/contabilidad/facturas
 */
async function create(req, res) {
    try {
        const ctx = req.ctx;
        const data = req.body;

        // Validaciones básicas
        if (!data.tipo || !['GASTO', 'INGRESO'].includes(data.tipo)) {
            return res.status(400).json({ ok: false, error: 'Tipo de factura inválido' });
        }

        // Asignar empresa: priorizar contexto, fallback a body
        if (ctx.empresaId) {
            data.id_empresa = ctx.empresaId;
        } else if (req.headers['x-empresa-id']) {
            data.id_empresa = parseInt(req.headers['x-empresa-id']);
        }

        if (!data.id_empresa) {
            // STRICT MODE: Empresa ID is required for accounting
            return res.status(400).json({ ok: false, error: 'Empresa ID requerida' });
        }

        // Security Check: Verify empresa belongs to tenant
        const empresaCheck = await req.db.query(
            'SELECT 1 FROM accounting_empresa WHERE id = $1 AND id_tenant = $2',
            [data.id_empresa, ctx.tenantId]
        );
        if (empresaCheck.rows.length === 0) {
            return res.status(400).json({ ok: false, error: 'Empresa no válida para este tenant' });
        }

        if (!data.numero_factura) {
            return res.status(400).json({ ok: false, error: 'Número de factura requerido' });
        }

        if (!data.fecha_emision) {
            return res.status(400).json({ ok: false, error: 'Fecha de emisión requerida' });
        }

        if (data.base_imponible === undefined || data.base_imponible < 0) {
            return res.status(400).json({ ok: false, error: 'Base imponible inválida' });
        }

        const factura = await service.createFactura(ctx, data);

        // Audit Log
        auditService.register(req, AUDIT_ACTIONS.FACTURA_CREATE, {
            entityType: 'FACTURA',
            entityId: factura.id,
            after: factura
        });

        res.status(201).json({
            ok: true,
            data: factura,
            message: 'Factura creada correctamente'
        });
    } catch (error) {
        console.error('Error en create factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message,
            requestId: req.requestId
        });
    }
}

/**
 * PATCH /api/contabilidad/facturas/:id
 */
async function update(req, res) {
    try {
        const ctx = req.ctx;
        const id = parseInt(req.params.id);
        const data = req.body;

        // Get old data for audit before updating
        const oldFactura = await service.getFactura(ctx, id);
        const factura = await service.updateFactura(ctx, id, data);

        // Audit Log
        auditService.register(req, AUDIT_ACTIONS.FACTURA_UPDATE, {
            entityType: 'FACTURA',
            entityId: id,
            before: oldFactura,
            after: factura
        });

        res.json({
            ok: true,
            data: factura,
            message: 'Factura actualizada correctamente'
        });
    } catch (error) {
        console.error('Error en update factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message,
            requestId: req.requestId
        });
    }
}

/**
 * DELETE /api/contabilidad/facturas/:id
 */
async function remove(req, res) {
    try {
        const ctx = req.ctx;
        const id = parseInt(req.params.id);
        // Get data for audit before deleting
        const oldFactura = await service.getFactura(ctx, id);
        await service.deleteFactura(ctx, id);

        // Audit Log
        auditService.register(req, AUDIT_ACTIONS.FACTURA_DELETE, {
            entityType: 'FACTURA',
            entityId: id,
            before: oldFactura
        });

        res.json({
            ok: true,
            message: 'Factura eliminada correctamente'
        });
    } catch (error) {
        console.error('Error en remove factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message,
            requestId: req.requestId
        });
    }
}

/**
 * POST /api/contabilidad/facturas/:id/archivo
 */
async function uploadArchivo(req, res) {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ ok: false, error: err.message });
        }

        try {
            const ctx = req.ctx;
            if (!req.file) {
                return res.status(400).json({ ok: false, error: 'No se recibió archivo' });
            }

            const facturaId = parseInt(req.params.id);

            const fileData = {
                file_url: `/uploads/contabilidad/${req.file.filename}`,
                storage_key: req.file.filename,
                mime_type: req.file.mimetype,
                size_bytes: req.file.size,
                original_name: req.file.originalname
            };

            const archivo = await service.addArchivo(ctx, facturaId, fileData);

            res.status(201).json({
                ok: true,
                data: archivo,
                message: 'Archivo subido correctamente'
            });
        } catch (error) {
            console.error('Error en uploadArchivo:', error);
            res.status(error.status || 500).json({
                ok: false,
                error: error.message,
                requestId: req.requestId
            });
        }
    });
}

/**
 * GET /api/contabilidad/facturas/:id/archivos
 */
async function listArchivos(req, res) {
    try {
        const ctx = req.ctx;
        const facturaId = parseInt(req.params.id);
        const archivos = await service.listArchivos(ctx, facturaId);

        // Enrich with existence check
        const enriched = archivos.map(file => {
            // Safer resolution: use UPLOADS_ROOT
            const { UPLOADS_ROOT } = require('../../../../core/config/storage');

            // file.file_url: "/uploads/contabilidad/filename.ext"
            let relativePath = file.file_url;
            if (relativePath.startsWith('/')) relativePath = relativePath.substring(1); // "uploads/contabilidad/..."
            if (relativePath.startsWith('api/')) relativePath = relativePath.substring(4); // "uploads/contabilidad/..."
            // Strip "uploads/" prefix if present in relative path to join properly with UPLOADS_ROOT
            if (relativePath.startsWith('uploads/')) relativePath = relativePath.substring(8);

            const absolutePath = path.join(UPLOADS_ROOT, relativePath);

            return {
                ...file,
                exists: fs.existsSync(absolutePath)
            };
        });

        res.json({
            ok: true,
            data: enriched
        });
    } catch (error) {
        console.error('Error en listArchivos:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message,
            requestId: req.requestId
        });
    }
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove,
    uploadArchivo,
    listArchivos
};
