/**
 * Tests de integración: KM obligatorios en órdenes
 * 
 * Valida que POST /api/ordenes y PUT /api/ordenes/:id:
 * 1. Rechaza órdenes sin km
 * 2. Rechaza órdenes con km = null
 * 3. Rechaza órdenes con km = 0
 * 4. Acepta órdenes con km válido >= 1
 */

// Mock del pool
const mockPool = {
    query: jest.fn(),
    connect: jest.fn(() => ({
        query: jest.fn(),
        release: jest.fn()
    })),
    txWithRLS: jest.fn(async (cb) => await cb(mockPool))
};
jest.mock('../../db', () => mockPool);

// Mock del tenant-db
jest.mock('../../src/core/db/tenant-db', () => ({
    getTenantDb: jest.fn(() => mockPool)
}));

const ordenesService = require('../../services/ordenesService');

// Mock del repository
jest.mock('../../repositories/ordenesRepository', () => ({
    checkSucursal: jest.fn().mockResolvedValue(true),
    checkCliente: jest.fn().mockResolvedValue(true),
    checkVehiculo: jest.fn().mockResolvedValue(true),
    checkMecanico: jest.fn().mockResolvedValue(true),
    checkSucursalExists: jest.fn().mockResolvedValue(true),
    checkClienteExists: jest.fn().mockResolvedValue(true),
    checkVehiculoExists: jest.fn().mockResolvedValue(true),
    checkMecanicoExists: jest.fn().mockResolvedValue(true),
    getTipoOrdenByCodigoOrId: jest.fn().mockResolvedValue({ id: 1, codigo: 'REPARACION' }),
    getEstadoOrdenByCodigoOrId: jest.fn().mockResolvedValue({ id: 1, codigo: 'PENDIENTE' }),
    getProductoById: jest.fn().mockResolvedValue({ id: 1, nombre: 'Test', id_impuesto: 1, stock: 100 }),
    getImpuestoById: jest.fn().mockResolvedValue({ id: 1, porcentaje: 21 }),
    ensureAlmacenPrincipal: jest.fn().mockResolvedValue(1),
    decreaseProductoStock: jest.fn().mockResolvedValue(true),
    createMovimientoInventario: jest.fn().mockResolvedValue(true),
    createOrden: jest.fn().mockResolvedValue({ id: 1 }),
    createOrdenLinea: jest.fn().mockResolvedValue(true),
    getOpenCaja: jest.fn().mockResolvedValue({ id: 1 }),
    createOpenCaja: jest.fn().mockResolvedValue({ id: 1 }),
    getMedioPagoByCodigoOrId: jest.fn().mockResolvedValue({ id: 1, codigo: 'EFECTIVO' }),
    createOrdenPago: jest.fn().mockResolvedValue({ id: 1 }),
    createCajaMovimiento: jest.fn().mockResolvedValue(true),
    updateOrdenTotales: jest.fn().mockResolvedValue(true)
}));

describe('KM obligatorios en órdenes', () => {
    // ordenesService is already imported as an instance

    const userContext = {
        id_tenant: 1,
        id_usuario: 1,
        is_super_admin: false
    };

    const datosBaseOrden = {
        idSucursal: 1,
        idCliente: 1,
        idVehiculo: 1,
        idMecanico: 1,
        idTipoOrden: 1,
        lineas: [
            { idProducto: 1, cantidad: 1, precio: 100, iva: 21, tipoItem: 'PRODUCTO' }
        ]
    };

    describe('POST /api/ordenes - createOrden', () => {
        test('Rechaza orden sin campo km', async () => {
            const dataSinKm = { ...datosBaseOrden };
            // No incluir km

            await expect(ordenesService.createOrden(dataSinKm, userContext))
                .rejects.toThrow('km es obligatorio');
        });

        test('Rechaza orden con km = null', async () => {
            const dataKmNull = { ...datosBaseOrden, km: null };

            await expect(ordenesService.createOrden(dataKmNull, userContext))
                .rejects.toThrow('km es obligatorio');
        });

        test('Rechaza orden con km = undefined', async () => {
            const dataKmUndefined = { ...datosBaseOrden, km: undefined };

            await expect(ordenesService.createOrden(dataKmUndefined, userContext))
                .rejects.toThrow('km es obligatorio');
        });

        test('Rechaza orden con km = "" (string vacío)', async () => {
            const dataKmVacio = { ...datosBaseOrden, km: '' };

            await expect(ordenesService.createOrden(dataKmVacio, userContext))
                .rejects.toThrow('km es obligatorio');
        });

        test('Rechaza orden con km = 0', async () => {
            const dataKmCero = { ...datosBaseOrden, km: 0 };

            await expect(ordenesService.createOrden(dataKmCero, userContext))
                .rejects.toThrow('km debe ser un número mayor o igual a 1');
        });

        test('Rechaza orden con km negativo', async () => {
            const dataKmNegativo = { ...datosBaseOrden, km: -100 };

            await expect(ordenesService.createOrden(dataKmNegativo, userContext))
                .rejects.toThrow('km debe ser un número mayor o igual a 1');
        });

        test('Rechaza orden con km no numérico', async () => {
            const dataKmTexto = { ...datosBaseOrden, km: 'abc' };

            await expect(ordenesService.createOrden(dataKmTexto, userContext))
                .rejects.toThrow('km debe ser un número mayor o igual a 1');
        });

        test('Acepta orden con km = 1 (mínimo válido)', async () => {
            const dataKmValido = { ...datosBaseOrden, km: 1 };

            // El test pasará la validación de km (puede fallar en otras validaciones después)
            // Lo importante es que NO falle por km
            try {
                await ordenesService.createOrden(dataKmValido, userContext);
            } catch (error) {
                // Si hay error, no debe ser por km
                expect(error.message).not.toContain('km');
            }
        });

        test('Acepta orden con km válido (ej: 125000)', async () => {
            const dataKmValido = { ...datosBaseOrden, km: 125000 };

            try {
                await ordenesService.createOrden(dataKmValido, userContext);
            } catch (error) {
                expect(error.message).not.toContain('km');
            }
        });

        test('Acepta km como string numérico ("50000")', async () => {
            const dataKmString = { ...datosBaseOrden, km: "50000" };

            try {
                await ordenesService.createOrden(dataKmString, userContext);
            } catch (error) {
                expect(error.message).not.toContain('km');
            }
        });
    });

    describe('PUT /api/ordenes/:id - updateOrden', () => {
        beforeEach(() => {
            // Mock: orden existe
            mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });
        });

        test('Rechaza actualización sin km', async () => {
            const dataSinKm = { ...datosBaseOrden };

            await expect(ordenesService.updateOrden(1, dataSinKm, userContext))
                .rejects.toThrow('km es obligatorio');
        });

        test('Rechaza actualización con km = null', async () => {
            const dataKmNull = { ...datosBaseOrden, km: null };

            await expect(ordenesService.updateOrden(1, dataKmNull, userContext))
                .rejects.toThrow('km es obligatorio');
        });

        test('Rechaza actualización con km = 0', async () => {
            const dataKmCero = { ...datosBaseOrden, km: 0 };

            await expect(ordenesService.updateOrden(1, dataKmCero, userContext))
                .rejects.toThrow('km debe ser un número mayor o igual a 1');
        });

        test('Acepta actualización con km válido', async () => {
            const dataKmValido = { ...datosBaseOrden, km: 80000 };

            try {
                await ordenesService.updateOrden(1, dataKmValido, userContext);
            } catch (error) {
                expect(error.message).not.toContain('km');
            }
        });
    });
});

describe('Mensaje de error claro', () => {
    // ordenesService is already imported as an instance

    test('El mensaje de error es claro y legible', async () => {
        const dataInvalida = {
            idSucursal: 1,
            idCliente: 1,
            idVehiculo: 1,
            idMecanico: 1,
            lineas: [{ cantidad: 1, precio: 100 }]
            // Sin km
        };

        try {
            await ordenesService.createOrden(dataInvalida, { id_tenant: 1, id_usuario: 1 });
        } catch (error) {
            // El mensaje debe ser claro para el usuario
            expect(error.message).toBe('km es obligatorio');
            expect(error.message).not.toContain('undefined');
            expect(error.message).not.toContain('null');
        }
    });
});
