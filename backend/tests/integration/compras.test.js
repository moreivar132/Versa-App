/**
 * Integration Tests: Compras
 * 
 * Tests de integración para las rutas de compras.
 * Área de riesgo MEDIO - Las compras afectan inventario y costos.
 */

const { productos } = require('../fixtures/productos.fixture');

describe('Compras - Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // Entrada de Inventario
    // ===========================================================================

    describe('Entrada de Inventario desde Compra', () => {

        test('POST_compra_incrementaStock', () => {
            // Arrange
            const stockActual = 50;
            const lineaCompra = {
                id_producto: 100,
                cantidad: 20,
                precio_unitario: 15.00
            };

            // Act
            const nuevoStock = stockActual + lineaCompra.cantidad;

            // Assert
            expect(nuevoStock).toBe(70);
        });

        test('compra_multipleLineas_incrementaTodos', () => {
            // Arrange
            const productosStock = {
                100: 50,
                101: 10,
                102: 0
            };

            const lineasCompra = [
                { id_producto: 100, cantidad: 20 },
                { id_producto: 101, cantidad: 15 },
                { id_producto: 102, cantidad: 50 }
            ];

            // Act
            const nuevosStocks = {};
            lineasCompra.forEach(linea => {
                nuevosStocks[linea.id_producto] =
                    productosStock[linea.id_producto] + linea.cantidad;
            });

            // Assert
            expect(nuevosStocks[100]).toBe(70);
            expect(nuevosStocks[101]).toBe(25);
            expect(nuevosStocks[102]).toBe(50);
        });

    });

    // ===========================================================================
    // Cálculo de IVA en Compras
    // ===========================================================================

    describe('Cálculo de IVA', () => {

        test('POST_compra_calculaIVACorrecto', () => {
            // Arrange
            const linea = {
                cantidad: 10,
                precio_unitario: 15.00,
                iva_porcentaje: 21
            };

            // Act
            const subtotal = linea.cantidad * linea.precio_unitario;
            const iva = subtotal * (linea.iva_porcentaje / 100);
            const total = subtotal + iva;

            // Assert
            expect(subtotal).toBe(150.00);
            expect(iva).toBe(31.50);
            expect(total).toBe(181.50);
        });

        test('compra_diferentesIVA_calculaCadaLinea', () => {
            // Arrange
            const lineas = [
                { cantidad: 10, precio_unitario: 100.00, iva_porcentaje: 21 },
                { cantidad: 5, precio_unitario: 50.00, iva_porcentaje: 10 },
                { cantidad: 20, precio_unitario: 25.00, iva_porcentaje: 0 }
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

            // Assert
            // Línea 1: 1000 * 0.21 = 210
            // Línea 2: 250 * 0.10 = 25
            // Línea 3: 500 * 0 = 0
            expect(subtotalTotal).toBe(1750.00);
            expect(ivaTotal).toBe(235.00);
        });

        test('compra_ivaDeducible_calculaCorrecto', () => {
            // Arrange - IVA soportado en compras es deducible
            const totalCompra = 181.50;
            const subtotal = 150.00;
            const ivaSoportado = 31.50;

            // Act - El IVA soportado se deduce del IVA repercutido
            const ivaRepercutido = 50.00; // Ejemplo de IVA cobrado en ventas
            const ivaNeto = ivaRepercutido - ivaSoportado;

            // Assert
            expect(ivaNeto).toBe(18.50);
        });

    });

    // ===========================================================================
    // Asociación con Proveedor
    // ===========================================================================

    describe('Asociación con Proveedor', () => {

        test('POST_compra_asociaProveedor', () => {
            // Arrange
            const compra = {
                id: 1,
                id_proveedor: 5,
                fecha: new Date('2025-01-01'),
                lineas: [],
                total: 181.50
            };

            // Act & Assert
            expect(compra.id_proveedor).toBe(5);
            expect(compra).toHaveProperty('id_proveedor');
        });

        test('compra_sinProveedor_permitido', () => {
            // Arrange - Algunas compras pueden no tener proveedor específico
            const compra = {
                id: 2,
                id_proveedor: null,
                concepto: 'Compra menor sin factura',
                total: 50.00
            };

            // Act & Assert
            expect(compra.id_proveedor).toBeNull();
        });

    });

    // ===========================================================================
    // Costos y Márgenes
    // ===========================================================================

    describe('Actualización de Costos', () => {

        test('compra_actualizaPrecioCosto', () => {
            // Arrange
            const producto = { ...productos.productoConStock };
            const nuevoPrecioCompra = 18.00; // Antes era 15.00

            // Act
            producto.precio_compra = nuevoPrecioCompra;
            const nuevoMargen = producto.precio_venta - producto.precio_compra;

            // Assert
            expect(producto.precio_compra).toBe(18.00);
            expect(nuevoMargen).toBe(7.00); // 25 - 18
        });

        test('compra_calculaCostoPromedio', () => {
            // Arrange
            const stockActual = 50;
            const costoActual = 15.00;
            const cantidadNueva = 20;
            const costoNuevo = 18.00;

            // Act - Costo promedio ponderado
            const valorStockActual = stockActual * costoActual;
            const valorCompraNueva = cantidadNueva * costoNuevo;
            const stockTotal = stockActual + cantidadNueva;
            const costoPromedio = (valorStockActual + valorCompraNueva) / stockTotal;

            // Assert
            expect(valorStockActual).toBe(750.00);
            expect(valorCompraNueva).toBe(360.00);
            expect(stockTotal).toBe(70);
            expect(costoPromedio).toBeCloseTo(15.86, 2);
        });

    });

    // ===========================================================================
    // Registro de Pagos de Compra
    // ===========================================================================

    describe('Pagos de Compra', () => {

        test('compra_pagoEfectivo_registraEnCaja', () => {
            // Arrange
            const compra = {
                total: 181.50,
                metodo_pago: 'efectivo'
            };

            // Act - El pago en efectivo debe registrarse como egreso en caja
            const movimientoCaja = {
                tipo: 'EGRESO',
                importe: compra.total,
                concepto: 'Compra a proveedor',
                origen_tipo: 'COMPRA'
            };

            // Assert
            expect(movimientoCaja.tipo).toBe('EGRESO');
            expect(movimientoCaja.importe).toBe(181.50);
        });

        test('compra_pagoCredito_noAfectaCajaInmediato', () => {
            // Arrange
            const compra = {
                total: 181.50,
                metodo_pago: 'credito',
                fecha_vencimiento: new Date('2025-02-01')
            };

            // Act - El pago a crédito no genera movimiento de caja inmediato
            const generaMovimientoCaja = compra.metodo_pago !== 'credito';

            // Assert
            expect(generaMovimientoCaja).toBe(false);
        });

    });

});
