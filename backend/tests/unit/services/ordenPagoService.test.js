/**
 * Unit Tests: OrdenPagoService
 * 
 * Tests críticos para el servicio de pagos de órdenes.
 * Área de riesgo ALTO - Registro incorrecto de pagos afecta directamente la caja.
 */

const { registrarPagoData, mediosPago, cajas } = require('../../fixtures/pagos.fixture');
const { ordenes } = require('../../fixtures/ordenes.fixture');

// Mock del pool de base de datos
const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
    txWithRLS: jest.fn(async (cb) => cb(mockClient)) // Mock transaction wrapper
};

const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient)
};

// Mock del repositorio
jest.mock('../../../repositories/ordenPagoRepository', () => ({
    obtenerDatosOrden: jest.fn(),
    obtenerMedioPagoPorCodigoOId: jest.fn(),
    existeCaja: jest.fn(),
    insertarPagoOrden: jest.fn()
}));

// Mock del repositorio de órdenes
jest.mock('../../../repositories/ordenesRepository', () => ({
    getOpenCaja: jest.fn(),
    createOpenCaja: jest.fn()
}));

// Mock de la conexión a BD
jest.mock('../../../db', () => mockPool);

// Mock de tenant-db
jest.mock('../../../src/core/db/tenant-db', () => ({
    getTenantDb: jest.fn().mockReturnValue(mockClient)
}));

const ordenPagoService = require('../../../services/ordenPagoService');
const ordenPagoRepository = require('../../../repositories/ordenPagoRepository');
const ordenesRepository = require('../../../repositories/ordenesRepository');

describe('OrdenPagoService', () => {
    let ctx;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset del mock client
        mockClient.query.mockReset();
        mockClient.release.mockReset();
        mockClient.txWithRLS.mockClear();

        ctx = { tenantId: 1, userId: 1 };
    });

    describe('registrarPago', () => {

        // =========================================================================
        // TESTS CRÍTICOS: Validación de inputs
        // =========================================================================

        describe('Validación de inputs', () => {

            test('registrarPago_sinIdOrden_lanzaError400', async () => {
                // Arrange
                const idOrden = null;
                const datosPago = registrarPagoData.valido;

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El ID de la orden es requerido.'
                    });
            });

            test('registrarPago_idOrdenUndefined_lanzaError400', async () => {
                // Arrange
                const idOrden = undefined;
                const datosPago = registrarPagoData.valido;

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El ID de la orden es requerido.'
                    });
            });

            test('registrarPago_importeNull_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, importe: null };

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El importe es requerido.'
                    });
            });

            test('registrarPago_importeUndefined_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, importe: undefined };

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El importe es requerido.'
                    });
            });

            test('registrarPago_importeVacio_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, importe: '' };

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El importe es requerido.'
                    });
            });

            test('registrarPago_importeCero_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.importeCero;

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El importe debe ser un número mayor a 0.'
                    });
            });

            test('registrarPago_importeNegativo_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.importeNegativo;

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El importe debe ser un número mayor a 0.'
                    });
            });

            test('registrarPago_importeNoNumerico_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, importe: 'abc' };

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El importe debe ser un número mayor a 0.'
                    });
            });

            test('registrarPago_sinMedioPago_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.sinMedioPago;

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: 'El medio de pago es requerido.'
                    });
            });

        });

        // =========================================================================
        // TESTS CRÍTICOS: Validación de existencia de entidades
        // =========================================================================

        describe('Validación de entidades', () => {

            test('registrarPago_ordenNoExiste_lanzaError404', async () => {
                // Arrange
                const idOrden = 999;
                const datosPago = registrarPagoData.valido;

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(null);

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 404,
                        message: `La orden con ID ${idOrden} no existe.`
                    });

                expect(ordenPagoRepository.obtenerDatosOrden).toHaveBeenCalledWith(mockClient, idOrden);
            });

            test('registrarPago_medioPagoInvalido_lanzaError404', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.medioPagoInexistente;

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(null);

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 404,
                        message: `El medio de pago '${datosPago.medioPago}' no existe.`
                    });

                expect(ordenPagoRepository.obtenerMedioPagoPorCodigoOId)
                    .toHaveBeenCalledWith(mockClient, datosPago.medioPago);
            });

            test('registrarPago_cajaNoExiste_lanzaError400', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, idCaja: 999 };

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(false);

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toMatchObject({
                        status: 400,
                        message: `La caja con ID ${datosPago.idCaja} no existe.`
                    });
            });

        });

        // =========================================================================
        // TESTS CRÍTICOS: Flujo exitoso
        // =========================================================================

        describe('Flujo exitoso', () => {

            test('registrarPago_conDatosValidos_creaPago', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.valido;

                const pagoCreado = {
                    id: 1,
                    id_orden: idOrden,
                    id_medio_pago: mediosPago.efectivo.id,
                    importe: datosPago.importe,
                    referencia: null,
                    id_caja: datosPago.idCaja,
                    created_by: datosPago.createdBy
                };

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue(pagoCreado);
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                const resultado = await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(resultado).toHaveProperty('pago');
                expect(resultado.pago).toEqual(pagoCreado);
                // When using txWithRLS, explicit BEGIN/COMMIT might not be called if wrapper handles it implicitly or we mock it that way.
                // But our mock wrapper calls callback directly.
                // We should check that repos are called with mockClient (which is the tx)
                expect(ordenPagoRepository.insertarPagoOrden).toHaveBeenCalledWith(mockClient, expect.any(Object));
            });

            test('registrarPago_conMedioPagoPorCodigo_resuelveCorrectamente', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.validoConCodigo; // medioPago: 'CARD'

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.tarjeta);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1 });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenPagoRepository.obtenerMedioPagoPorCodigoOId)
                    .toHaveBeenCalledWith(mockClient, 'CARD');
            });

            test('registrarPago_conMedioPagoPorId_resuelveCorrectamente', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.validoConId; // medioPago: 1

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1 });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenPagoRepository.obtenerMedioPagoPorCodigoOId)
                    .toHaveBeenCalledWith(mockClient, 1);
            });

        });

        // =========================================================================
        // TESTS CRÍTICOS: Auto-creación de caja
        // =========================================================================

        describe('Auto-detección y creación de caja', () => {

            test('registrarPago_sinCaja_detectaCajaAbierta', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.sinCaja;

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenesRepository.getOpenCaja.mockResolvedValue(cajas.abierta);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1, id_caja: cajas.abierta.id });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                const resultado = await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenesRepository.getOpenCaja).toHaveBeenCalledWith(
                    mockClient,
                    ordenes.ordenCompleta.id_sucursal
                );
                expect(ordenPagoRepository.insertarPagoOrden).toHaveBeenCalledWith(
                    mockClient,
                    expect.objectContaining({ id_caja: cajas.abierta.id })
                );
            });

            test('registrarPago_sinCaja_creaNuevaCaja', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.sinCaja;
                const nuevaCaja = { id: 5, id_sucursal: 1, estado: 'ABIERTA' };

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenesRepository.getOpenCaja.mockResolvedValue(null); // No hay caja abierta
                ordenesRepository.createOpenCaja.mockResolvedValue(nuevaCaja);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1, id_caja: nuevaCaja.id });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenesRepository.createOpenCaja).toHaveBeenCalledWith(
                    mockClient,
                    ordenes.ordenCompleta.id_sucursal,
                    datosPago.createdBy
                );
                expect(ordenPagoRepository.insertarPagoOrden).toHaveBeenCalledWith(
                    mockClient,
                    expect.objectContaining({ id_caja: nuevaCaja.id })
                );
            });

        });

        // =========================================================================
        // TESTS CRÍTICOS: Transacciones y Rollback
        // =========================================================================

        describe('Manejo de transacciones', () => {

            test('registrarPago_errorEnInsercion_propagaError', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.valido;
                const errorDB = new Error('Error de base de datos');

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockRejectedValue(errorDB);

                // Act & Assert
                await expect(ordenPagoService.registrarPago(ctx, idOrden, datosPago))
                    .rejects
                    .toThrow('Error de base de datos');

                // Rollback handles automatically by txWithRLS usually, or by propagation.
                // In our mock, we just propagate.
            });
        });

        // =========================================================================
        // TESTS ADICIONALES: Casos edge
        // =========================================================================

        describe('Casos edge', () => {

            test('registrarPago_importeDecimal_proceseCorrectamente', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, importe: 123.45 };

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1 });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenPagoRepository.insertarPagoOrden).toHaveBeenCalledWith(
                    mockClient,
                    expect.objectContaining({ importe: 123.45 })
                );
            });

            test('registrarPago_importeComoString_convierteANumero', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = { ...registrarPagoData.valido, importe: '500.50' };

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1 });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenPagoRepository.insertarPagoOrden).toHaveBeenCalledWith(
                    mockClient,
                    expect.objectContaining({ importe: 500.50 })
                );
            });

            test('registrarPago_referenciaNull_proceseCorrectamente', async () => {
                // Arrange
                const idOrden = 1;
                const datosPago = registrarPagoData.valido; // referencia: null

                ordenPagoRepository.obtenerDatosOrden.mockResolvedValue(ordenes.ordenCompleta);
                ordenPagoRepository.obtenerMedioPagoPorCodigoOId.mockResolvedValue(mediosPago.efectivo);
                ordenPagoRepository.existeCaja.mockResolvedValue(true);
                ordenPagoRepository.insertarPagoOrden.mockResolvedValue({ id: 1 });
                mockClient.query.mockResolvedValue({ rows: [] });

                // Act
                await ordenPagoService.registrarPago(ctx, idOrden, datosPago);

                // Assert
                expect(ordenPagoRepository.insertarPagoOrden).toHaveBeenCalledWith(
                    mockClient,
                    expect.objectContaining({ referencia: null })
                );
            });

        });

    });

});
