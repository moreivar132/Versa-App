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

// File filter
const fileFilter = (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no soportado. Solo imágenes y videos.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
});

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
        const fileUrl = `/uploads/${req.file.filename}`;

        res.json({
            ok: true,
            url: fileUrl,
            type: req.file.mimetype.startsWith('image/') ? 'IMAGEN' : 'VIDEO',
            originalName: req.file.originalname
        });

    } catch (error) {
        console.error('Error en upload:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
