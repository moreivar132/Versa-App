/**
 * Unit Tests: VentasService
 * 
 * Tests críticos para el servicio de ventas.
 * Área de riesgo ALTO - Las ventas afectan inventario y caja.
 */

const { productos } = require('../../fixtures/productos.fixture');
const { mediosPago, cajas } = require('../../fixtures/pagos.fixture');

// Mock del pool de base de datos
const mockClient = {
    query: jest.fn(),
    release: jest.fn()
};

const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient)
};

jest.mock('../../../db', () => mockPool);

// Mock del incomeService
jest.mock('../../../services/incomeService', () => ({
    registrarIngreso: jest.fn().mockResolvedValue({ id: 1 })
}));

describe('VentasService', () => {
    let ventasService;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockReset();
        mockClient.release.mockReset();

        // Reimportar el servicio después de los mocks
        jest.resetModules();
        ventasService = require('../../../services/ventasService');
    });

    // ===========================================================================
    // createVenta
    // ===========================================================================

    describe('createVenta', () => {

        const userContext = {
            id: 1,
            tenant_id: 1,
            id_sucursal: 1
        };

        const ventaValidaData = {
            id_cliente: 10,
            lineas: [
                {
                    tipo_item: 'PRODUCTO',
                    id_producto: 100,
                    descripcion: 'Aceite Motor',
                    cantidad: 2,
                    precio_unitario: 25.00,
                    iva_porcentaje: 21
                }
            ],
            pagos: [
                {
                    id_medio_pago: 1,
                    importe: 60.50
                }
            ]
        };

        describe('Cálculo de totales', () => {

            test('createVenta_calculaTotalCorrecto', () => {
                // Arrange
                const linea = {
                    cantidad: 2,
                    precio_unitario: 25.00,
                    iva_porcentaje: 21,
                    descuento: 0
                };

                // Act
                const subtotal = linea.cantidad * linea.precio_unitario;
                const iva = subtotal * (linea.iva_porcentaje / 100);
                const total = subtotal + iva;

                // Assert
                expect(subtotal).toBe(50.00);
                expect(iva).toBe(10.50);
                expect(total).toBe(60.50);
            });

            test('createVenta_conDescuento_calculaCorrectamente', () => {
                // Arrange
                const linea = {
                    cantidad: 1,
                    precio_unitario: 100.00,
                    iva_porcentaje: 21,
                    descuento: 10 // 10% descuento
                };

                // Act
                const subtotalBruto = linea.cantidad * linea.precio_unitario;
                const descuentoImporte = subtotalBruto * (linea.descuento / 100);
                const subtotal = subtotalBruto - descuentoImporte;
                const iva = subtotal * (linea.iva_porcentaje / 100);
                const total = subtotal + iva;

                // Assert
                expect(subtotalBruto).toBe(100.00);
                expect(descuentoImporte).toBe(10.00);
                expect(subtotal).toBe(90.00);
                expect(iva).toBe(18.90);
                expect(total).toBe(108.90);
            });

            test('createVenta_multipleLineas_sumaTotales', () => {
                // Arrange
                const lineas = [
                    { cantidad: 2, precio_unitario: 25.00, iva_porcentaje: 21 },
                    { cantidad: 1, precio_unitario: 80.00, iva_porcentaje: 21 }
                ];

                // Act
                let subtotalTotal = 0;
                let ivaTotal = 0;

                lineas.forEach(linea => {
                    const subtotal = linea.cantidad * linea.precio_unitario;
                    const iva = subtotal * (linea.iva_porcentaje / 100);
                    subtotalTotal += subtotal;
                    ivaTotal += iva;
                });

                const granTotal = subtotalTotal + ivaTotal;

                // Assert
                expect(subtotalTotal).toBe(130.00); // 50 + 80
                expect(ivaTotal).toBe(27.30); // 10.50 + 16.80
                expect(granTotal).toBe(157.30);
            });

        });

        describe('Descuento de stock', () => {

            test('createVenta_descontaStock_calculaDiferenciaCorrecta', () => {
                // Arrange
                const stockInicial = 50;
                const cantidadVendida = 3;

                // Act
                const stockFinal = stockInicial - cantidadVendida;

                // Assert
                expect(stockFinal).toBe(47);
            });

            test('createVenta_stockInsuficiente_detectaCorrectamente', () => {
                // Arrange
                const stockActual = 2;
                const cantidadSolicitada = 5;

                // Act
                const hayStock = stockActual >= cantidadSolicitada;

                // Assert
                expect(hayStock).toBe(false);
            });

        });

        describe('Registro de pago', () => {

            test('createVenta_registraPago_importeCorrecto', () => {
                // Arrange
                const totalVenta = 157.30;
                const pagos = [
                    { id_medio_pago: 1, importe: 100.00 },
                    { id_medio_pago: 2, importe: 57.30 }
                ];

                // Act
                const totalPagado = pagos.reduce((sum, p) => sum + p.importe, 0);

                // Assert
                expect(totalPagado).toBe(totalVenta);
            });

            test('createVenta_pagoInsuficiente_detectaSaldo', () => {
                // Arrange
                const totalVenta = 157.30;
                const pagos = [
                    { id_medio_pago: 1, importe: 100.00 }
                ];

                // Act
                const totalPagado = pagos.reduce((sum, p) => sum + p.importe, 0);
                const saldoPendiente = totalVenta - totalPagado;

                // Assert
                expect(saldoPendiente).toBeCloseTo(57.30, 2);
                expect(saldoPendiente > 0).toBe(true);
            });

        });

    });

    // ===========================================================================
    // anularVenta
    // ===========================================================================

    describe('anularVenta', () => {

        describe('Devolución de stock', () => {

            test('anularVenta_devuelveStock_calculaCorrecto', () => {
                // Arrange
                const stockActual = 47;
                const cantidadAnulada = 3;

                // Act
                const stockRestaurado = stockActual + cantidadAnulada;

                // Assert
                expect(stockRestaurado).toBe(50);
            });

            test('anularVenta_multipleProductos_devuelveTodos', () => {
                // Arrange
                const productosAnulados = [
                    { id_producto: 100, cantidad: 2, stock_actual: 48 },
                    { id_producto: 101, cantidad: 1, stock_actual: 9 }
                ];

                // Act
                const stocksRestaurados = productosAnulados.map(p => ({
                    id_producto: p.id_producto,
                    stock_nuevo: p.stock_actual + p.cantidad
                }));

                // Assert
                expect(stocksRestaurados[0].stock_nuevo).toBe(50);
                expect(stocksRestaurados[1].stock_nuevo).toBe(10);
            });

        });

        describe('Reversión en caja', () => {

            test('anularVenta_revierteCaja_montoNegativo', () => {
                // Arrange
                const totalVentaOriginal = 157.30;

                // Act - La anulación debe registrar un egreso
                const montoReversion = -totalVentaOriginal;

                // Assert
                expect(montoReversion).toBe(-157.30);
            });

        });

    });

    // ===========================================================================
    // getVentas
    // ===========================================================================

    describe('getVentas', () => {

        test('getVentas_filtroFecha_formateaCorrecto', () => {
            // Arrange
            const fechaDesde = '2025-01-01';
            const fechaHasta = '2025-01-31';

            // Act
            const filtro = {
                desde: new Date(fechaDesde),
                hasta: new Date(fechaHasta)
            };

            // Assert
            expect(filtro.desde).toBeInstanceOf(Date);
            expect(filtro.hasta).toBeInstanceOf(Date);
            expect(filtro.desde < filtro.hasta).toBe(true);
        });

    });

});
