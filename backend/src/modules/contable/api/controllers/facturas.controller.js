/**
 * Facturas Controller
 * CRUD de facturas contables
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

/**
 * Helper para obtener empresa ID
 */
function getEmpresaId(req) {
    return req.headers['x-empresa-id'] || req.query.empresaId;
}

// Configurar multer para uploads
const uploadDir = path.join(__dirname, '../../../../../uploads/contabilidad');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

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
            idSucursal: req.query.idSucursal ? parseInt(req.query.idSucursal) : null,
            search: req.query.search,
            idEmpresa: getEmpresaId(req),
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await service.listFacturas(tenantId, filters);

        res.json({
            ok: true,
            ...result
        });
    } catch (error) {
        console.error('Error en list facturas:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/facturas/:id
 */
async function getById(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const factura = await service.getFactura(tenantId, id);

        res.json({
            ok: true,
            data: factura
        });
    } catch (error) {
        console.error('Error en getById factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * POST /api/contabilidad/facturas
 */
async function create(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const userId = req.user?.id;
        const data = req.body;

        // Validaciones básicas
        if (!data.tipo || !['GASTO', 'INGRESO'].includes(data.tipo)) {
            return res.status(400).json({ ok: false, error: 'Tipo de factura inválido' });
        }

        // Asignar empresa si existe en contexto
        const empresaId = getEmpresaId(req);
        if (empresaId) {
            data.id_empresa = empresaId;
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

        const factura = await service.createFactura(tenantId, data, userId);

        res.status(201).json({
            ok: true,
            data: factura,
            message: 'Factura creada correctamente'
        });
    } catch (error) {
        console.error('Error en create factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * PATCH /api/contabilidad/facturas/:id
 */
async function update(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const userId = req.user?.id;
        const data = req.body;

        const factura = await service.updateFactura(tenantId, id, data, userId);

        res.json({
            ok: true,
            data: factura,
            message: 'Factura actualizada correctamente'
        });
    } catch (error) {
        console.error('Error en update factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * DELETE /api/contabilidad/facturas/:id
 */
async function remove(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const id = parseInt(req.params.id);
        const userId = req.user?.id;

        await service.deleteFactura(tenantId, id, userId);

        res.json({
            ok: true,
            message: 'Factura eliminada correctamente'
        });
    } catch (error) {
        console.error('Error en remove factura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
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
            const tenantId = getEffectiveTenant(req);
            if (!tenantId) {
                return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
            }

            if (!req.file) {
                return res.status(400).json({ ok: false, error: 'No se recibió archivo' });
            }

            const facturaId = parseInt(req.params.id);
            const userId = req.user?.id;

            const fileData = {
                file_url: `/uploads/contabilidad/${req.file.filename}`,
                storage_key: req.file.filename,
                mime_type: req.file.mimetype,
                size_bytes: req.file.size,
                original_name: req.file.originalname
            };

            const archivo = await service.addArchivo(tenantId, facturaId, fileData, userId);

            res.status(201).json({
                ok: true,
                data: archivo,
                message: 'Archivo subido correctamente'
            });
        } catch (error) {
            console.error('Error en uploadArchivo:', error);
            res.status(error.status || 500).json({
                ok: false,
                error: error.message
            });
        }
    });
}

/**
 * GET /api/contabilidad/facturas/:id/archivos
 */
async function listArchivos(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const facturaId = parseInt(req.params.id);
        const archivos = await service.listArchivos(tenantId, facturaId);

        res.json({
            ok: true,
            data: archivos
        });
    } catch (error) {
        console.error('Error en listArchivos:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
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
