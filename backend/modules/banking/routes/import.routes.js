const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const verifyJWT = require('../../../middleware/auth');
const { requireEmpresaAccess } = require('../../../middleware/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(verifyJWT);
router.use(requireEmpresaAccess());

// Inject Tenant DB
const { getTenantDb } = require('../../../src/core/db/tenant-db');
router.use((req, res, next) => {
    try {
        req.db = getTenantDb(req.user);
        next();
    } catch (err) {
        console.error('Error injecting Tenant DB:', err);
        res.status(500).json({ error: 'Database context error' });
    }
});

// Configure multer
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Unique filename: bank_import_<ts>_<random>.<ext>
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `bank_import_${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Routes
router.post('/imports', verifyJWT, upload.single('file'), importController.uploadImport);
router.post('/imports/:id/parse', verifyJWT, importController.parseImport);
router.post('/imports/:id/commit', verifyJWT, importController.commitImport);
router.get('/imports', verifyJWT, importController.getHistory);

module.exports = router;
