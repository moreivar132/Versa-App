/**
 * Validation Utilities
 * Helpers para validación de datos sin dependencias externas.
 * 
 * NOTA: Para validaciones más complejas, considerar Zod o Joi en el futuro.
 * Por ahora, mantenemos esto ligero.
 */

const { ValidationError } = require('../http/middlewares/error-handler');

/**
 * Validar que los campos requeridos estén presentes
 * @param {Object} data - Datos a validar
 * @param {string[]} requiredFields - Lista de campos requeridos
 * @throws {ValidationError}
 */
function validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => {
        const value = data[field];
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        throw new ValidationError({
            message: `Campos requeridos faltantes: ${missing.join(', ')}`,
            fields: missing
        });
    }
}

/**
 * Validar que un valor sea un ID numérico válido
 * @param {*} value - Valor a validar
 * @param {string} fieldName - Nombre del campo para el mensaje de error
 * @throws {ValidationError}
 */
function validateId(value, fieldName = 'id') {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed <= 0) {
        throw new ValidationError({
            message: `${fieldName} debe ser un número positivo`,
            field: fieldName,
            value
        });
    }
    return parsed;
}

/**
 * Validar email
 * @param {string} email
 * @throws {ValidationError}
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        throw new ValidationError({
            message: 'Email inválido',
            field: 'email',
            value: email
        });
    }
    return email.toLowerCase().trim();
}

/**
 * Validar teléfono (formato español o internacional)
 * @param {string} phone
 * @throws {ValidationError}
 */
function validatePhone(phone) {
    if (!phone) return null;

    // Limpiar espacios y caracteres especiales
    const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

    // Debe tener al menos 9 dígitos
    if (!/^\+?\d{9,15}$/.test(cleaned)) {
        throw new ValidationError({
            message: 'Teléfono inválido',
            field: 'telefono',
            value: phone
        });
    }
    return cleaned;
}

/**
 * Validar fecha
 * @param {string} dateStr - Fecha en formato ISO o similar
 * @throws {ValidationError}
 */
function validateDate(dateStr, fieldName = 'fecha') {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new ValidationError({
            message: `${fieldName} no es una fecha válida`,
            field: fieldName,
            value: dateStr
        });
    }
    return date;
}

/**
 * Validar que un valor esté en una lista de opciones
 * @param {*} value
 * @param {Array} options
 * @param {string} fieldName
 */
function validateEnum(value, options, fieldName = 'valor') {
    if (!options.includes(value)) {
        throw new ValidationError({
            message: `${fieldName} debe ser uno de: ${options.join(', ')}`,
            field: fieldName,
            value,
            allowedValues: options
        });
    }
    return value;
}

/**
 * Sanitizar string (trim y escape básico)
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.trim();
}

module.exports = {
    validateRequired,
    validateId,
    validateEmail,
    validatePhone,
    validateDate,
    validateEnum,
    sanitizeString
};
