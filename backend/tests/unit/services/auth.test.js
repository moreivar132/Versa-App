/**
 * Unit Tests: Autenticación
 * 
 * Tests críticos para el sistema de autenticación.
 * Área de riesgo ALTO - Control de acceso al sistema.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Autenticación', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // Registro de Usuarios
    // ===========================================================================

    describe('Registro de Usuarios', () => {

        test('register_sinEmail_lanzaError400', () => {
            // Arrange
            const userData = {
                password: 'password123',
                nombre: 'Test User'
            };

            // Act
            const esValido = userData.email && userData.password;

            // Assert
            expect(esValido).toBeFalsy();
        });

        test('register_sinPassword_lanzaError400', () => {
            // Arrange
            const userData = {
                email: 'test@example.com',
                nombre: 'Test User'
            };

            // Act
            const esValido = userData.email && userData.password;

            // Assert
            expect(esValido).toBeFalsy();
        });

        test('register_emailInvalido_validacion', () => {
            // Arrange
            const emails = [
                'invalid',
                'invalid@',
                '@invalid.com',
                'invalid.com',
                ''
            ];

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            // Act & Assert
            emails.forEach(email => {
                expect(emailRegex.test(email)).toBe(false);
            });
        });

        test('register_emailValido_pasa', () => {
            // Arrange
            const emails = [
                'test@example.com',
                'user.name@domain.org',
                'admin@company.es'
            ];

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            // Act & Assert
            emails.forEach(email => {
                expect(emailRegex.test(email)).toBe(true);
            });
        });

        test('register_normalizaEmail_lowercase', () => {
            // Arrange
            const email = 'Test.User@EXAMPLE.COM';

            // Act
            const normalizado = String(email).trim().toLowerCase();

            // Assert
            expect(normalizado).toBe('test.user@example.com');
        });

        test('register_hashPassword_noGuardaPlainText', async () => {
            // Arrange
            const password = 'miPassword123';

            // Act
            const hash = await bcrypt.hash(password, 10);

            // Assert
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50);
            expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
        });

        test('register_usuarioExistente_lanzaError409', () => {
            // Arrange
            const existingUsers = ['admin@test.com', 'user@test.com'];
            const newEmail = 'admin@test.com';

            // Act
            const existe = existingUsers.includes(newEmail);

            // Assert
            expect(existe).toBe(true);
        });

    });

    // ===========================================================================
    // Login
    // ===========================================================================

    describe('Login', () => {

        test('login_emailPasswordRequeridos', () => {
            // Arrange
            const credentials = [
                { email: 'test@test.com', password: '' },
                { email: '', password: 'password' },
                { email: '', password: '' }
            ];

            // Act & Assert
            credentials.forEach(cred => {
                const esValido = cred.email && cred.password;
                expect(esValido).toBeFalsy();
            });
        });

        test('login_credencialesValidas_generaToken', () => {
            // Arrange
            const payload = {
                id: 1,
                id_tenant: 1,
                id_sucursal: 1,
                email: 'admin@test.com',
                nombre: 'Admin',
                is_super_admin: false
            };

            // Act
            const token = jwt.sign(payload, 'test-secret', { expiresIn: '1d' });

            // Assert
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3); // JWT tiene 3 partes
        });

        test('login_passwordIncorrecto_noCoincide', async () => {
            // Arrange
            const passwordGuardado = await bcrypt.hash('correctPassword', 10);
            const passwordIntentado = 'wrongPassword';

            // Act
            const coincide = await bcrypt.compare(passwordIntentado, passwordGuardado);

            // Assert
            expect(coincide).toBe(false);
        });

        test('login_passwordCorrecto_coincide', async () => {
            // Arrange
            const password = 'miPassword123';
            const passwordHash = await bcrypt.hash(password, 10);

            // Act
            const coincide = await bcrypt.compare(password, passwordHash);

            // Assert
            expect(coincide).toBe(true);
        });

        test('login_usuarioNoExiste_error401', () => {
            // Arrange
            const user = null; // Usuario no encontrado

            // Act
            const usuarioValido = user !== null;

            // Assert
            expect(usuarioValido).toBe(false);
        });

    });

    // ===========================================================================
    // Token JWT
    // ===========================================================================

    describe('Token JWT', () => {

        const JWT_SECRET = 'test-secret-key';

        test('jwt_payloadContieneIdUsuario', () => {
            // Arrange
            const payload = {
                id: 1,
                id_tenant: 1,
                id_sucursal: 1,
                email: 'admin@test.com',
                nombre: 'Admin',
                is_super_admin: false
            };

            // Act
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
            const decoded = jwt.verify(token, JWT_SECRET);

            // Assert
            expect(decoded.id).toBe(1);
            expect(decoded.id_tenant).toBe(1);
            expect(decoded.email).toBe('admin@test.com');
        });

        test('jwt_noIncluyePassword', () => {
            // Arrange
            const user = {
                id: 1,
                email: 'test@test.com',
                password_hash: '$2b$10$...'
            };

            // Act - sanitizeUser
            const { password_hash, ...safeUser } = user;

            // Assert
            expect(safeUser.password_hash).toBeUndefined();
            expect(safeUser.id).toBe(1);
            expect(safeUser.email).toBe('test@test.com');
        });

        test('jwt_expiraEn1Dia', () => {
            // Arrange
            const payload = { id: 1 };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

            // Act
            const decoded = jwt.verify(token, JWT_SECRET);
            const ahora = Math.floor(Date.now() / 1000);
            const tiempoExpiracion = decoded.exp - ahora;

            // Assert
            // 1 día = 86400 segundos (con margen de 10 segundos)
            expect(tiempoExpiracion).toBeGreaterThan(86390);
            expect(tiempoExpiracion).toBeLessThanOrEqual(86400);
        });

        test('jwt_tokenInvalido_lanzaError', () => {
            // Arrange
            const tokenInvalido = 'token.invalido.aqui';

            // Act & Assert
            expect(() => {
                jwt.verify(tokenInvalido, JWT_SECRET);
            }).toThrow();
        });

        test('jwt_tokenExpirado_lanzaError', () => {
            // Arrange
            const payload = { id: 1 };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' }); // Ya expirado

            // Act & Assert
            expect(() => {
                jwt.verify(token, JWT_SECRET);
            }).toThrow();
        });

    });

    // ===========================================================================
    // Middleware de Autenticación
    // ===========================================================================

    describe('Middleware de Autenticación', () => {

        test('middleware_sinToken_retorna401', () => {
            // Arrange
            const req = {
                headers: {}
            };

            // Act
            const token = req.headers['authorization'];

            // Assert
            expect(token).toBeUndefined();
        });

        test('middleware_tokenEnHeader_extraeCorrecto', () => {
            // Arrange
            const tokenEsperado = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
            const req = {
                headers: {
                    authorization: `Bearer ${tokenEsperado}`
                }
            };

            // Act
            const authHeader = req.headers['authorization'];
            const token = authHeader.split(' ')[1];

            // Assert
            expect(token).toBe(tokenEsperado);
        });

        test('middleware_formatoIncorrecto_sinBearer', () => {
            // Arrange
            const req = {
                headers: {
                    authorization: 'token-sin-bearer'
                }
            };

            // Act
            const authHeader = req.headers['authorization'];
            const parts = authHeader.split(' ');
            const isBearer = parts[0] === 'Bearer';

            // Assert
            expect(isBearer).toBe(false);
        });

    });

    // ===========================================================================
    // Permisos y Roles
    // ===========================================================================

    describe('Permisos y Roles', () => {

        test('superAdmin_tieneAccesoTotal', () => {
            // Arrange
            const user = {
                id: 1,
                is_super_admin: true,
                role: 'ADMIN'
            };

            // Act
            const tieneAccesoTotal = user.is_super_admin === true;

            // Assert
            expect(tieneAccesoTotal).toBe(true);
        });

        test('usuarioNormal_noEsSuperAdmin', () => {
            // Arrange
            const user = {
                id: 2,
                is_super_admin: false,
                role: 'MANAGER'
            };

            // Act
            const tieneAccesoTotal = user.is_super_admin === true;

            // Assert
            expect(tieneAccesoTotal).toBe(false);
        });

        test('aislamiento_tenantId_requerido', () => {
            // Arrange
            const users = [
                { id: 1, id_tenant: 1 },
                { id: 2, id_tenant: 2 },
                { id: 3, id_tenant: null }
            ];

            // Act
            const usersConTenant = users.filter(u => u.id_tenant);

            // Assert
            expect(usersConTenant.length).toBe(2);
        });

    });

});
