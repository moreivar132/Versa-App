/**
 * Unit Tests: OrdenPagoRepository
 * 
 * Tests para el repositorio de pagos de órdenes.
 * Verifica las operaciones de base de datos para pagos.
 */

const { mediosPago, pagos } = require('../../fixtures/pagos.fixture');
const { ordenes } = require('../../fixtures/ordenes.fixture');

// Mock del pool de base de datos
const mockPool = {
    query: jest.fn()
};

jest.mock('../../../db', () => mockPool);

const ordenPagoRepository = require('../../../repositories/ordenPagoRepository');

describe('OrdenPagoRepository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // existeOrden
    // ===========================================================================

    describe('existeOrden', () => {

        test('existeOrden_ordenExiste_retornaTrue', async () => {
            // Arrange
            const idOrden = 1;
            mockPool.query.mockResolvedValue({ rowCount: 1 });

            // Act
            const resultado = await ordenPagoRepository.existeOrden(idOrden);

            // Assert
            expect(resultado).toBe(true);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT 1 FROM orden WHERE id = $1',
                [idOrden]
            );
        });

        test('existeOrden_ordenNoExiste_retornaFalse', async () => {
            // Arrange
            const idOrden = 999;
            mockPool.query.mockResolvedValue({ rowCount: 0 });

            // Act
            const resultado = await ordenPagoRepository.existeOrden(idOrden);

            // Assert
            expect(resultado).toBe(false);
        });

    });

    // ===========================================================================
    // obtenerDatosOrden
    // ===========================================================================

    describe('obtenerDatosOrden', () => {

        test('obtenerDatosOrden_ordenExiste_retornaDatos', async () => {
            // Arrange
            const idOrden = 1;
            const ordenData = { id: 1, id_sucursal: 1 };
            mockPool.query.mockResolvedValue({ rows: [ordenData] });

            // Act
            const resultado = await ordenPagoRepository.obtenerDatosOrden(idOrden);

            // Assert
            expect(resultado).toEqual(ordenData);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT id, id_sucursal FROM orden WHERE id = $1',
                [idOrden]
            );
        });

        test('obtenerDatosOrden_ordenNoExiste_retornaUndefined', async () => {
            // Arrange
            const idOrden = 999;
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const resultado = await ordenPagoRepository.obtenerDatosOrden(idOrden);

            // Assert
            expect(resultado).toBeUndefined();
        });

    });

    // ===========================================================================
    // obtenerMedioPagoPorCodigoOId
    // ===========================================================================

    describe('obtenerMedioPagoPorCodigoOId', () => {

        test('obtenerMedioPagoPorCodigo_existe_retornaMedioPago', async () => {
            // Arrange
            const codigo = 'CASH';
            mockPool.query.mockResolvedValue({ rows: [mediosPago.efectivo] });

            // Act
            const resultado = await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(codigo);

            // Assert
            expect(resultado).toEqual(mediosPago.efectivo);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT * FROM mediopago WHERE UPPER(codigo) = UPPER($1)',
                [codigo]
            );
        });

        test('obtenerMedioPagoPorId_existe_retornaMedioPago', async () => {
            // Arrange
            const id = 1;
            mockPool.query.mockResolvedValue({ rows: [mediosPago.efectivo] });

            // Act
            const resultado = await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(id);

            // Assert
            expect(resultado).toEqual(mediosPago.efectivo);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT * FROM mediopago WHERE id = $1',
                [id]
            );
        });

        test('obtenerMedioPagoPorCodigo_noExiste_retornaNull', async () => {
            // Arrange
            const codigo = 'CRYPTO';
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const resultado = await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(codigo);

            // Assert
            expect(resultado).toBeNull();
        });

        test('obtenerMedioPagoPorCodigo_caseInsensitive_funciona', async () => {
            // Arrange
            const codigo = 'cash'; // minúsculas
            mockPool.query.mockResolvedValue({ rows: [mediosPago.efectivo] });

            // Act
            await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(codigo);

            // Assert
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT * FROM mediopago WHERE UPPER(codigo) = UPPER($1)',
                ['cash']
            );
        });

        test('obtenerMedioPagoPorId_idString_detectaComoNumero', async () => {
            // Arrange
            const id = '1'; // String numérico
            mockPool.query.mockResolvedValue({ rows: [mediosPago.efectivo] });

            // Act
            await ordenPagoRepository.obtenerMedioPagoPorCodigoOId(id);

            // Assert
            // isNaN('1') es false, por lo que debería buscar por ID
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT * FROM mediopago WHERE id = $1',
                ['1']
            );
        });

    });

    // ===========================================================================
    // existeCaja
    // ===========================================================================

    describe('existeCaja', () => {

        test('existeCaja_cajaExiste_retornaTrue', async () => {
            // Arrange
            const idCaja = 1;
            mockPool.query.mockResolvedValue({ rowCount: 1 });

            // Act
            const resultado = await ordenPagoRepository.existeCaja(idCaja);

            // Assert
            expect(resultado).toBe(true);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT 1 FROM caja WHERE id = $1',
                [idCaja]
            );
        });

        test('existeCaja_cajaNoExiste_retornaFalse', async () => {
            // Arrange
            const idCaja = 999;
            mockPool.query.mockResolvedValue({ rowCount: 0 });

            // Act
            const resultado = await ordenPagoRepository.existeCaja(idCaja);

            // Assert
            expect(resultado).toBe(false);
        });

    });

    // ===========================================================================
    // insertarPagoOrden
    // ===========================================================================

    describe('insertarPagoOrden', () => {

        test('insertarPagoOrden_datosValidos_insertaRegistro', async () => {
            // Arrange
            const pagoData = {
                id_orden: 1,
                id_medio_pago: 1,
                importe: 500.00,
                referencia: 'REF-001',
                id_caja: 1,
                created_by: 1
            };

            const pagoInsertado = { id: 1, ...pagoData };
            mockPool.query.mockResolvedValue({ rows: [pagoInsertado] });

            // Act
            const resultado = await ordenPagoRepository.insertarPagoOrden(pagoData);

            // Assert
            expect(resultado).toEqual(pagoInsertado);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ordenpago'),
                [
                    pagoData.id_orden,
                    pagoData.id_medio_pago,
                    pagoData.importe,
                    pagoData.referencia,
                    pagoData.id_caja,
                    pagoData.created_by
                ]
            );
        });

        test('insertarPagoOrden_conClienteTransaccion_usaCliente', async () => {
            // Arrange
            const pagoData = {
                id_orden: 1,
                id_medio_pago: 1,
                importe: 500.00,
                referencia: null,
                id_caja: 1,
                created_by: 1
            };

            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] })
            };

            // Act
            await ordenPagoRepository.insertarPagoOrden(pagoData, mockClient);

            // Assert
            expect(mockClient.query).toHaveBeenCalled();
            expect(mockPool.query).not.toHaveBeenCalled();
        });

        test('insertarPagoOrden_sinReferencia_insertaNull', async () => {
            // Arrange
            const pagoData = {
                id_orden: 1,
                id_medio_pago: 1,
                importe: 500.00,
                referencia: undefined, // sin referencia
                id_caja: 1,
                created_by: 1
            };

            mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

            // Act
            await ordenPagoRepository.insertarPagoOrden(pagoData);

            // Assert
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([undefined]) // referencia undefined
            );
        });

    });

    // ===========================================================================
    // obtenerPagosPorOrden
    // ===========================================================================

    describe('obtenerPagosPorOrden', () => {

        test('obtenerPagosPorOrden_conPagos_retornaArray', async () => {
            // Arrange
            const idOrden = 1;
            const pagosOrden = [
                { ...pagos.pagoEfectivo, medio_pago_nombre: 'Efectivo', medio_pago_codigo: 'CASH' },
                { ...pagos.pagoTarjeta, medio_pago_nombre: 'Tarjeta', medio_pago_codigo: 'CARD' }
            ];
            mockPool.query.mockResolvedValue({ rows: pagosOrden });

            // Act
            const resultado = await ordenPagoRepository.obtenerPagosPorOrden(idOrden);

            // Assert
            expect(resultado).toEqual(pagosOrden);
            expect(resultado).toHaveLength(2);
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT op.*'),
                [idOrden]
            );
        });

        test('obtenerPagosPorOrden_sinPagos_retornaArrayVacio', async () => {
            // Arrange
            const idOrden = 999;
            mockPool.query.mockResolvedValue({ rows: [] });

            // Act
            const resultado = await ordenPagoRepository.obtenerPagosPorOrden(idOrden);

            // Assert
            expect(resultado).toEqual([]);
            expect(resultado).toHaveLength(0);
        });

    });

    // ===========================================================================
    // obtenerTodosMediosPago
    // ===========================================================================

    describe('obtenerTodosMediosPago', () => {

        test('obtenerTodosMediosPago_retornaLista', async () => {
            // Arrange
            const todosMedios = [
                mediosPago.efectivo,
                mediosPago.tarjeta,
                mediosPago.transferencia,
                mediosPago.cuentaCorriente
            ];
            mockPool.query.mockResolvedValue({ rows: todosMedios });

            // Act
            const resultado = await ordenPagoRepository.obtenerTodosMediosPago();

            // Assert
            expect(resultado).toEqual(todosMedios);
            expect(resultado).toHaveLength(4);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT * FROM mediopago ORDER BY id ASC'
            );
        });

    });

});
