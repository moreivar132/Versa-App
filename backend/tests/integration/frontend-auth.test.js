/**
 * Tests de Autenticación Frontend
 * 
 * Verifica que TODOS los archivos HTML protegidos tienen 
 * la protección de autenticación correcta (guard.js o requireAuth).
 * 
 * ⚠️ IMPORTANTE: Este test escanea automáticamente el directorio frontend
 * y fallará si encuentra algún archivo HTML de manager/admin sin protección.
 */

const fs = require('fs');
const path = require('path');

describe('Frontend - Protección de Autenticación', () => {

    const frontendDir = path.join(__dirname, '../../../frontend');

    // Páginas que son PÚBLICAS (no requieren autenticación)
    const PUBLIC_PAGES = [
        'login.html',
        'cita-previa.html',
        'portal-cliente.html',
        'cliente-login.html',
        'index.html',
        'cliente-dashboard.html' // Portal de clientes tiene su propia auth
    ];

    // Patrones de archivos que DEBEN estar protegidos
    const PROTECTED_PATTERNS = [
        /^manager-.*\.html$/,    // Todas las páginas de manager
        /^admin-.*\.html$/,      // Todas las páginas de admin
        /^super-admin.*\.html$/  // Todas las páginas de super admin
    ];

    /**
     * Obtiene todos los archivos HTML del frontend que deberían estar protegidos
     */
    function getProtectedHtmlFiles() {
        const files = fs.readdirSync(frontendDir);

        return files.filter(file => {
            // Solo archivos HTML
            if (!file.endsWith('.html')) return false;

            // Excluir páginas públicas
            if (PUBLIC_PAGES.includes(file)) return false;

            // Incluir solo si coincide con algún patrón protegido
            return PROTECTED_PATTERNS.some(pattern => pattern.test(file));
        });
    }

    /**
     * Verifica si un archivo tiene protección de autenticación
     */
    function hasAuthProtection(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verificar múltiples formas de protección
        const hasGuardJs = content.includes('guard.js');
        const hasRequireAuth = content.includes('requireAuth');
        const hasAuthImport = content.includes("from '/auth.js'") ||
            content.includes("from './auth.js'");

        return hasGuardJs || hasRequireAuth || hasAuthImport;
    }

    // =========================================================================
    // Test principal: Todas las páginas protegidas tienen autenticación
    // =========================================================================

    describe('Detección automática de páginas sin protección', () => {

        const protectedFiles = getProtectedHtmlFiles();

        test('Se encontraron archivos HTML para verificar', () => {
            expect(protectedFiles.length).toBeGreaterThan(0);
            console.log(`📁 Encontrados ${protectedFiles.length} archivos HTML protegidos`);
        });

        protectedFiles.forEach(fileName => {
            test(`✅ ${fileName} tiene protección de autenticación`, () => {
                const filePath = path.join(frontendDir, fileName);

                if (!fs.existsSync(filePath)) {
                    throw new Error(`Archivo no encontrado: ${fileName}`);
                }

                const isProtected = hasAuthProtection(filePath);

                if (!isProtected) {
                    throw new Error(
                        `❌ ${fileName} NO tiene protección de autenticación!\n` +
                        `   Solución: Agregar <script src="/guard.js"></script> en el <head>\n` +
                        `   O si es página pública, añadir a PUBLIC_PAGES en este test.`
                    );
                }

                expect(isProtected).toBe(true);
            });
        });

    });

    // =========================================================================
    // Verificar que las páginas públicas NO fuerzan login incorrecto
    // =========================================================================

    describe('Páginas públicas accesibles sin login', () => {

        PUBLIC_PAGES.forEach(pageName => {
            test(`${pageName} es página pública`, () => {
                const filePath = path.join(frontendDir, pageName);

                // Algunas páginas públicas pueden no existir
                if (!fs.existsSync(filePath)) {
                    console.log(`ℹ️ Página pública no encontrada (OK): ${pageName}`);
                    return;
                }

                const content = fs.readFileSync(filePath, 'utf-8');

                // Si tiene guard.js está bien porque guard.js ignora estas páginas
                // Pero no debería tener redirección forzada sin guard.js
                const hasGuard = content.includes('guard.js');
                const forcesLoginWithoutGuard =
                    content.includes("window.location.replace('login.html')") &&
                    !hasGuard &&
                    !content.includes('PUBLIC_PAGES');

                expect(forcesLoginWithoutGuard).toBe(false);
            });
        });

    });

    // =========================================================================
    // Verificar integridad de guard.js
    // =========================================================================

    describe('guard.js tiene protección correcta', () => {

        const guardPath = path.join(frontendDir, 'public', 'guard.js');

        test('guard.js existe en public/', () => {
            expect(fs.existsSync(guardPath)).toBe(true);
        });

        test('guard.js verifica localStorage', () => {
            const content = fs.readFileSync(guardPath, 'utf-8');
            expect(content).toContain('localStorage');
            expect(content).toContain('SESSION_KEY');
        });

        test('guard.js hace validación con servidor', () => {
            const content = fs.readFileSync(guardPath, 'utf-8');
            expect(content).toContain('/api/auth/me');
            expect(content).toContain('validateTokenWithServer');
        });

        test('guard.js tiene lista de páginas públicas', () => {
            const content = fs.readFileSync(guardPath, 'utf-8');
            expect(content).toContain('PUBLIC_PAGES');
            expect(content).toContain('login.html');
        });

        test('guard.js redirige a login si no hay sesión', () => {
            const content = fs.readFileSync(guardPath, 'utf-8');
            expect(content).toContain('redirectToLogin');
            expect(content).toContain('login.html');
        });

        test('guard.js maneja logout', () => {
            const content = fs.readFileSync(guardPath, 'utf-8');
            expect(content).toContain('logout');
            expect(content).toContain('removeItem');
        });

    });

    // =========================================================================
    // Verificar integridad de auth.js
    // =========================================================================

    describe('auth.js tiene funciones requeridas', () => {

        const authPath = path.join(frontendDir, 'auth.js');

        test('auth.js existe', () => {
            expect(fs.existsSync(authPath)).toBe(true);
        });

        test('auth.js exporta requireAuth', () => {
            const content = fs.readFileSync(authPath, 'utf-8');
            expect(content).toContain('export async function requireAuth');
        });

        test('auth.js exporta getSession', () => {
            const content = fs.readFileSync(authPath, 'utf-8');
            expect(content).toContain('export function getSession');
        });

        test('auth.js exporta fetchWithAuth', () => {
            const content = fs.readFileSync(authPath, 'utf-8');
            expect(content).toContain('export async function fetchWithAuth');
        });

        test('auth.js maneja 401 en fetchWithAuth', () => {
            const content = fs.readFileSync(authPath, 'utf-8');
            expect(content).toContain('response.status === 401');
            expect(content).toContain('redirectToLogin');
        });

    });

    // =========================================================================
    // Resumen de cobertura
    // =========================================================================

    describe('Resumen de cobertura', () => {

        test('Mostrar estadísticas de protección', () => {
            const allHtmlFiles = fs.readdirSync(frontendDir)
                .filter(f => f.endsWith('.html'));

            const protectedFiles = getProtectedHtmlFiles();
            const publicFiles = allHtmlFiles.filter(f => PUBLIC_PAGES.includes(f));
            const otherFiles = allHtmlFiles.filter(f =>
                !protectedFiles.includes(f) && !PUBLIC_PAGES.includes(f)
            );

            console.log('\n📊 ESTADÍSTICAS DE PROTECCIÓN:');
            console.log(`   Total HTML: ${allHtmlFiles.length}`);
            console.log(`   Protegidos: ${protectedFiles.length}`);
            console.log(`   Públicos: ${publicFiles.length}`);
            console.log(`   Otros: ${otherFiles.length}`);

            if (otherFiles.length > 0) {
                console.log(`\n⚠️ Archivos no clasificados:`);
                otherFiles.forEach(f => console.log(`   - ${f}`));
            }

            expect(true).toBe(true);
        });

    });

});
