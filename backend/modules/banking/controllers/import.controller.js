const bankImportService = require('../services/bankImport.service');
const bankService = require('../services/bankService');
const path = require('path');
const pool = require('../../../db');

exports.uploadImport = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No se subió archivo' });
        }

        // req.file available via multer
        const tenantId = req.user.id_tenant; // middleware auth
        const userId = req.user.id;
        const idEmpresa = req.body.id_empresa || req.headers['x-empresa-id'];

        if (!idEmpresa) {
            return res.status(400).json({ ok: false, error: 'id_empresa es requerido' });
        }

        const result = await bankImportService.uploadFile(req.file, tenantId, userId, idEmpresa);

        res.json({ ok: true, ...result });
    } catch (e) {
        console.error('Upload Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
};

exports.parseImport = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id_tenant;

        const result = await bankImportService.parseImport(id, tenantId);
        res.json({ ok: true, ...result });

    } catch (e) {
        console.error('Parse Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
};

exports.commitImport = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.id_tenant;
        const { bank_account_id } = req.body;

        console.log(`[BankingImport] Commit requested for import ${id}, account ${bank_account_id}`);

        const result = await bankService.commitImport(id, tenantId, { bank_account_id });
        res.json({ ok: true, ...result });

    } catch (e) {
        console.error('Commit Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const tenantId = req.user.id_tenant;
        const idEmpresa = req.query.id_empresa || req.headers['x-empresa-id'];

        if (!idEmpresa) {
            return res.status(400).json({ ok: false, error: 'id_empresa es requerido' });
        }

        const result = await pool.query(
            'SELECT * FROM bank_import WHERE tenant_id = $1 AND id_empresa = $2 ORDER BY created_at DESC',
            [tenantId, idEmpresa]
        );
        res.json({ ok: true, imports: result.rows });
    } catch (e) {
        console.error('History Error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
};
