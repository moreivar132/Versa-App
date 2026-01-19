/**
 * Utilidades de cifrado para tokens sensibles
 * Usa AES-256-GCM para cifrar refresh tokens
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Obtiene la clave de cifrado del entorno
 * @returns {Buffer} Clave de 32 bytes
 */
function getEncryptionKey() {
    const key = process.env.OPEN_BANKING_TOKEN_ENC_KEY;
    if (!key) {
        throw new Error('OPEN_BANKING_TOKEN_ENC_KEY no está configurada');
    }

    // Si la clave es hex, convertir; si no, usar como string y hashear
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
        return Buffer.from(key, 'hex');
    }

    // Derivar clave de 32 bytes desde string arbitrario
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * Cifra un texto plano
 * @param {string} plaintext - Texto a cifrar
 * @returns {string} Texto cifrado en formato: iv:authTag:ciphertext (hex)
 */
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH
    });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descifra un texto cifrado
 * @param {string} encryptedText - Texto cifrado (iv:authTag:ciphertext)
 * @returns {string} Texto plano
 */
function decrypt(encryptedText) {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
        throw new Error('Formato de texto cifrado inválido');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Genera una clave segura para usar como OPEN_BANKING_TOKEN_ENC_KEY
 * @returns {string} Clave hex de 64 caracteres (32 bytes)
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    generateEncryptionKey
};
