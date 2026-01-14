/**
 * Smoke Test Template
 * Verifica que el módulo carga correctamente sin errores de sintaxis.
 */

describe('Module Template', () => {
    test('routes module loads without error', () => {
        expect(() => {
            require('../module.routes');
        }).not.toThrow();
    });

    test('controller module loads without error', () => {
        expect(() => {
            require('../module.controller');
        }).not.toThrow();
    });

    test('service module loads without error', () => {
        expect(() => {
            require('../module.service');
        }).not.toThrow();
    });

    test('repo module loads without error', () => {
        expect(() => {
            require('../module.repo');
        }).not.toThrow();
    });

    test('schemas module loads without error', () => {
        expect(() => {
            require('../module.schemas');
        }).not.toThrow();
    });
});
