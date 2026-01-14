/**
 * Auth Helpers para Tests
 * 
 * Proporciona funciones para generar tokens y contextos de autenticación
 * válidos para usar en tests de integración.
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

// Secret de test - usa el mismo que el backend para que los tokens sean válidos
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

/**
 * Genera un token JWT válido para tests
 * @param {Object} payload - Datos del usuario
 * @param {number} payload.id - ID del usuario
 * @param {number} payload.id_tenant - ID del tenant
 * @param {boolean} [payload.is_super_admin] - Si es super admin
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.expiresIn='1h'] - Tiempo de expiración
 * @returns {string} Token JWT
 */
function generateTestToken(payload, options = {}) {
    const { expiresIn = '1h' } = options;

    const defaultPayload = {
        id: 1,
        id_tenant: 1,
        is_super_admin: false,
        ...payload
    };

    return jwt.sign(defaultPayload, TEST_JWT_SECRET, { expiresIn });
}

/**
 * Crea headers de autorización para supertest
 * @param {Object} [userOverrides] - Sobrescribir datos del usuario
 * @returns {Object} Headers con Authorization Bearer
 */
function authHeaders(userOverrides = {}) {
    const token = generateTestToken(userOverrides);
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Crea headers sin token (para test de 401)
 */
function noAuthHeaders() {
    return {
        'Content-Type': 'application/json'
    };
}

/**
 * Crea headers con token pero sin tenant (para test de 403 tenant)
 * @returns {Object}
 */
function noTenantHeaders() {
    const token = jwt.sign(
        { id: 1 },  // Sin id_tenant
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Usuarios de prueba predefinidos
 */
const TEST_USERS = {
    // Usuario normal con tenant
    normal: {
        id: 1,
        id_tenant: 1,
        is_super_admin: false
    },
    // Super admin
    superAdmin: {
        id: 99,
        id_tenant: 1,
        is_super_admin: true
    },
    // Usuario sin permisos específicos
    noPermissions: {
        id: 100,
        id_tenant: 1,
        is_super_admin: false
    }
};

module.exports = {
    generateTestToken,
    authHeaders,
    noAuthHeaders,
    noTenantHeaders,
    TEST_USERS,
    TEST_JWT_SECRET
};
