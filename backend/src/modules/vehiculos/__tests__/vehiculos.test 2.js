/**
 * Tests de Integración: Módulo Vehículos V2
 */

const vehiculosService = require('../application/vehiculos.service');
const vehiculosRepo = require('../infra/vehiculos.repo');

jest.mock('../infra/vehiculos.repo');

describe('Vehículos Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('crearVehiculo', () => {
        const validCtx = {
            tenantId: 1,
            userId: 10,
            requestId: 'test-123',
            isSuperAdmin: false
        };

        const validVehiculoData = {
            id_sucursal: 1,
            matricula: 'ABC123',
            marca: 'Toyota',
            modelo: 'Corolla',
            year: 2022
        };

        test('OK: Crea vehículo con datos válidos', async () => {
            vehiculosRepo.create.mockResolvedValue({
                id: 1,
                ...validVehiculoData
            });

            const result = await vehiculosService.crearVehiculo(validCtx, validVehiculoData);

            expect(result).toHaveProperty('id', 1);
            expect(result).toHaveProperty('matricula', 'ABC123');
            expect(vehiculosRepo.create).toHaveBeenCalledWith(validCtx, validVehiculoData);
        });

        test('ERROR 400: Falta sucursal obligatoria', async () => {
            const dataSinSucursal = {
                matricula: 'ABC123',
                marca: 'Toyota',
                modelo: 'Corolla'
            };

            await expect(vehiculosService.crearVehiculo(validCtx, dataSinSucursal))
                .rejects.toThrow('Sucursal, Matrícula, Marca y Modelo son obligatorios');
        });

        test('ERROR 400: Falta matrícula', async () => {
            const dataSinMatricula = {
                id_sucursal: 1,
                marca: 'Toyota',
                modelo: 'Corolla'
            };

            await expect(vehiculosService.crearVehiculo(validCtx, dataSinMatricula))
                .rejects.toThrow('Sucursal, Matrícula, Marca y Modelo son obligatorios');
        });
    });

    describe('actualizarVehiculo', () => {
        const ctx = { tenantId: 1, userId: 10 };

        test('ERROR 404: Vehículo no encontrado', async () => {
            vehiculosRepo.update.mockResolvedValue(null);

            await expect(vehiculosService.actualizarVehiculo(ctx, 999, {}))
                .rejects.toThrow('Vehículo no encontrado');
        });

        test('OK: Actualiza vehículo existente', async () => {
            const updatedData = { id: 1, matricula: 'XYZ789' };
            vehiculosRepo.update.mockResolvedValue(updatedData);

            const result = await vehiculosService.actualizarVehiculo(ctx, 1, updatedData);

            expect(result.matricula).toBe('XYZ789');
        });
    });

    describe('buscarVehiculos', () => {
        test('ERROR 400: Sin parámetro de búsqueda ni cliente', async () => {
            const ctx = { tenantId: 1 };

            await expect(vehiculosService.buscarVehiculos(ctx, {}))
                .rejects.toThrow('Parámetro de búsqueda requerido');
        });

        test('OK: Búsqueda por cliente', async () => {
            const ctx = { tenantId: 1 };
            vehiculosRepo.search.mockResolvedValue([{ id: 1 }]);

            const result = await vehiculosService.buscarVehiculos(ctx, { id_cliente: 5 });

            expect(result).toHaveLength(1);
        });

        test('OK: Búsqueda por término', async () => {
            const ctx = { tenantId: 1 };
            vehiculosRepo.search.mockResolvedValue([{ id: 1, matricula: 'ABC' }]);

            const result = await vehiculosService.buscarVehiculos(ctx, { q: 'ABC' });

            expect(result).toHaveLength(1);
        });
    });
});
