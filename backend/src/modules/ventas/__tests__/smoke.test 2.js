/**
 * Smoke Test - Módulo Ventas
 * Verifica que todos los componentes del módulo cargan sin errores.
 */

describe('Módulo Ventas', () => {
    test('routes carga sin error', () => {
        expect(() => {
            require('../api/ventas.routes');
        }).not.toThrow();
    });

    test('controller carga sin error', () => {
        expect(() => {
            require('../api/ventas.controller');
        }).not.toThrow();
    });

    test('service carga sin error', () => {
        expect(() => {
            require('../application/ventas.service');
        }).not.toThrow();
    });

    test('repo carga sin error', () => {
        expect(() => {
            require('../infra/ventas.repo');
        }).not.toThrow();
    });
});
