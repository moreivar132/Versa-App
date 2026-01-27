
const path = require('path');
const fs = require('fs');

/**
 * Storage Configuration
 * Centralizes the definition of where files are stored.
 * Critical for Railway Volumes (persistent storage).
 */

// Define root based on environment variable (priority) or CWD
// On Railway, we will mount the Volume to /app/backend/uploads
const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads');

// Ensure root exists on startup
try {
    if (!fs.existsSync(UPLOADS_ROOT)) {
        fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
        console.log(`[Storage] Created root uploads directory: ${UPLOADS_ROOT}`);
    }
} catch (err) {
    console.error(`[Storage] CRITICAL: Failed to create uploads directory at ${UPLOADS_ROOT}`, err);
}

/**
 * Helper to get and ensure a specific subfolder exists
 * @param {string} subfolder - e.g. 'contabilidad', 'egresos'
 * @returns {string} Absolute path
 */
function getUploadPath(subfolder = '') {
    const target = path.join(UPLOADS_ROOT, subfolder);
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }
    return target;
}

module.exports = {
    UPLOADS_ROOT,
    getUploadPath
};
