const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp-random-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter - Accept images, videos, and common documents
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/', 'video/',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ];

    const isAllowed = allowedMimes.some(mime =>
        file.mimetype.startsWith(mime) || file.mimetype === mime
    );

    if (isAllowed) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no soportado. Solo imágenes, videos, PDFs y documentos.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
});

// Helper function to determine file type
function getFileType(mimetype) {
    if (mimetype.startsWith('image/')) return 'IMAGEN';
    if (mimetype.startsWith('video/')) return 'VIDEO';
    return 'ARCHIVO';
}

// Upload endpoint
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No se subió ningún archivo' });
        }

        // Construct public URL
        // Assuming backend is served at the same host/port or proxied
        // We'll return a relative path or full URL depending on needs.
        // For now, let's return a relative path that the frontend can prepend API_URL to, 
        // OR better yet, a path that can be served via static middleware.

        // If we serve 'uploads' at '/uploads', then:
        const fileUrl = `/api/uploads/${req.file.filename}`;

        res.json({
            ok: true,
            url: fileUrl,
            type: getFileType(req.file.mimetype),
            originalName: req.file.originalname
        });

    } catch (error) {
        console.error('Error en upload:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
