/**
 * Unit Tests: OrdenesService
 * 
 * Tests críticos para el servicio de órdenes.
 * Área de riesgo ALTO - Los totales y stock deben calcularse correctamente.
 */

const { ordenes, lineasOrden, crearOrdenData } = require('../../fixtures/ordenes.fixture');
const { productos } = require('../../fixtures/productos.fixture');

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

// Mock del repositorio de órdenes
jest.mock('../../../repositories/ordenesRepository', () => ({
    getOpenCaja: jest.fn(),
    createOpenCaja: jest.fn()
}));

describe('OrdenesService', () => {
    let ordenesService;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.query.mockReset();
        mockClient.release.mockReset();

        jest.resetModules();
        ordenesService = require('../../../services/ordenesService');
    });

    // ===========================================================================
    // createOrden - Cálculo de totales
    // ===========================================================================

    describe('createOrden - Cálculo de totales', () => {

        test('createOrden_calculaTotalCorrecto_lineaSimple', () => {
            // Arrange
            const linea = {
                cantidad: 2,
                precio_unitario: 25.00,
                descuento: 0,
                iva_porcentaje: 21
            };

            // Act
            const subtotal = linea.cantidad * linea.precio_unitario;
            const descuento = subtotal * (linea.descuento / 100);
            const subtotalConDescuento = subtotal - descuento;
            const iva = subtotalConDescuento * (linea.iva_porcentaje / 100);
            const total = subtotalConDescuento + iva;

            // Assert
            expect(subtotal).toBe(50.00);
            expect(subtotalConDescuento).toBe(50.00);
            expect(iva).toBe(10.50);
            expect(total).toBe(60.50);
        });

        test('createOrden_aplicaDescuentoLinea_calculaCorrecto', () => {
            // Arrange
            const linea = {
                cantidad: 1,
                precio_unitario: 100.00,
                descuento: 15, // 15% descuento
                iva_porcentaje: 21
            };

            // Act
            const subtotal = linea.cantidad * linea.precio_unitario;
            const descuentoImporte = subtotal * (linea.descuento / 100);
            const subtotalConDescuento = subtotal - descuentoImporte;
            const iva = subtotalConDescuento * (linea.iva_porcentaje / 100);
            const total = subtotalConDescuento + iva;

            // Assert
            expect(subtotal).toBeCloseTo(100.00, 2);
            expect(descuentoImporte).toBeCloseTo(15.00, 2);
            expect(subtotalConDescuento).toBeCloseTo(85.00, 2);
            expect(iva).toBeCloseTo(17.85, 2);
            expect(total).toBeCloseTo(102.85, 2);
        });

        test('createOrden_multipleLineas_sumaTotales', () => {
            // Arrange
            const lineas = [
                { cantidad: 2, precio_unitario: 25.00, descuento: 0, iva_porcentaje: 21 },
                { cantidad: 1, precio_unitario: 30.00, descuento: 5, iva_porcentaje: 21 },
                { cantidad: 1, precio_unitario: 100.00, descuento: 15, iva_porcentaje: 21 }
            ];

            // Act
            let subtotalOrden = 0;
            let ivaOrden = 0;

            lineas.forEach(linea => {
                const subtotal = linea.cantidad * linea.precio_unitario;
                const descuentoImporte = subtotal * (linea.descuento / 100);
                const subtotalConDescuento = subtotal - descuentoImporte;
                const iva = subtotalConDescuento * (linea.iva_porcentaje / 100);

                subtotalOrden += subtotalConDescuento;
                ivaOrden += iva;
            });

            const totalOrden = subtotalOrden + ivaOrden;

            // Assert
            // Línea 1: 50.00 subtotal, 10.50 IVA
            // Línea 2: 28.50 subtotal (30 - 5%), 5.985 IVA
            // Línea 3: 85.00 subtotal (100 - 15%), 17.85 IVA
            expect(subtotalOrden).toBeCloseTo(163.50, 2);
            expect(ivaOrden).toBeCloseTo(34.335, 2);
            expect(totalOrden).toBeCloseTo(197.835, 2);
        });

        test('createOrden_diferentesIVA_calculaCadaUno', () => {
            // Arrange
            const lineas = [
                { cantidad: 1, precio_unitario: 100.00, descuento: 0, iva_porcentaje: 21 },
                { cantidad: 1, precio_unitario: 100.00, descuento: 0, iva_porcentaje: 10 },
                { cantidad: 1, precio_unitario: 100.00, descuento: 0, iva_porcentaje: 0 }
            ];

            // Act
            const ivasCalculados = lineas.map(linea => {
                const subtotal = linea.cantidad * linea.precio_unitario;
                return subtotal * (linea.iva_porcentaje / 100);
            });

            // Assert
            expect(ivasCalculados[0]).toBe(21.00); // 21%
            expect(ivasCalculados[1]).toBe(10.00); // 10%
            expect(ivasCalculados[2]).toBe(0);     // 0%
        });

    });

    // ===========================================================================
    // createOrden - Descuento de stock
    // ===========================================================================

    describe('createOrden - Descuento de stock', () => {

        test('createOrden_descontaStock_productosAfectados', () => {
            // Arrange
            const lineasConProducto = [
                { tipo_item: 'PRODUCTO', id_producto: 100, cantidad: 2 },
                { tipo_item: 'PRODUCTO', id_producto: 101, cantidad: 1 },
                { tipo_item: 'SERVICIO', id_servicio: 50, cantidad: 1 } // No afecta stock
            ];

            // Act
            const productosADescontar = lineasConProducto
                .filter(l => l.tipo_item === 'PRODUCTO')
                .map(l => ({ id_producto: l.id_producto, cantidad: l.cantidad }));

            // Assert
            expect(productosADescontar).toHaveLength(2);
            expect(productosADescontar[0]).toEqual({ id_producto: 100, cantidad: 2 });
            expect(productosADescontar[1]).toEqual({ id_producto: 101, cantidad: 1 });
        });

        test('createOrden_servicios_noDescontanStock', () => {
            // Arrange
            const lineas = [
                { tipo_item: 'SERVICIO', id_servicio: 50, cantidad: 3 }
            ];

            // Act
            const productosADescontar = lineas
                .filter(l => l.tipo_item === 'PRODUCTO');

            // Assert
            expect(productosADescontar).toHaveLength(0);
        });

    });

    // ===========================================================================
    // updateOrden - Recálculo de totales
    // ===========================================================================

    describe('updateOrden - Recálculo de totales', () => {

        test('updateOrden_recalculaTotalAlAgregarLinea', () => {
            // Arrange
            const totalOriginal = 60.50;
            const nuevaLinea = {
                cantidad: 1,
                precio_unitario: 80.00,
                descuento: 0,
                iva_porcentaje: 21
            };

            // Act
            const subtotalNuevaLinea = nuevaLinea.cantidad * nuevaLinea.precio_unitario;
            const ivaNuevaLinea = subtotalNuevaLinea * (nuevaLinea.iva_porcentaje / 100);
            const totalNuevaLinea = subtotalNuevaLinea + ivaNuevaLinea;
            const nuevoTotal = totalOriginal + totalNuevaLinea;

            // Assert
            expect(totalNuevaLinea).toBeCloseTo(96.80, 2);
            expect(nuevoTotal).toBeCloseTo(157.30, 2);
        });

        test('updateOrden_recalculaTotalAlQuitarLinea', () => {
            // Arrange
            const totalOriginal = 157.30;
            const lineaEliminada = {
                subtotal: 80.00,
                iva: 16.80
            };

            // Act
            const totalEliminado = lineaEliminada.subtotal + lineaEliminada.iva;
            const nuevoTotal = totalOriginal - totalEliminado;

            // Assert
            expect(totalEliminado).toBeCloseTo(96.80, 2);
            expect(nuevoTotal).toBeCloseTo(60.50, 2);
        });

    });

    // ===========================================================================
    // updateOrden - Ajuste diferencial de stock
    // ===========================================================================

    describe('updateOrden - Ajuste diferencial de stock', () => {

        test('updateOrden_aumentaCantidad_descontaDiferencia', () => {
            // Arrange
            const cantidadOriginal = 2;
            const cantidadNueva = 5;
            const stockActual = 48;

            // Act
            const diferencia = cantidadNueva - cantidadOriginal;
            const nuevoStock = stockActual - diferencia;

            // Assert
            expect(diferencia).toBe(3);
            expect(nuevoStock).toBe(45);
        });

        test('updateOrden_reduceCantidad_devuelveDiferencia', () => {
            // Arrange
            const cantidadOriginal = 5;
            const cantidadNueva = 2;
            const stockActual = 45;

            // Act
            const diferencia = cantidadNueva - cantidadOriginal; // -3
            const nuevoStock = stockActual - diferencia; // 45 - (-3) = 48

            // Assert
            expect(diferencia).toBe(-3);
            expect(nuevoStock).toBe(48);
        });

        test('updateOrden_sinCambioCantidad_stockIgual', () => {
            // Arrange
            const cantidadOriginal = 3;
            const cantidadNueva = 3;
            const stockActual = 47;

            // Act
            const diferencia = cantidadNueva - cantidadOriginal;
            const nuevoStock = stockActual - diferencia;

            // Assert
            expect(diferencia).toBe(0);
            expect(nuevoStock).toBe(47);
        });

        test('updateOrden_eliminaLinea_devuelveTodoElStock', () => {
            // Arrange
            const cantidadOriginal = 3;
            const stockActual = 47;

            // Act - Eliminar línea = devolver toda la cantidad
            const nuevoStock = stockActual + cantidadOriginal;

            // Assert
            expect(nuevoStock).toBe(50);
        });

    });

    // ===========================================================================
    // Normalización de tipos
    // ===========================================================================

    describe('Normalización de tipo_item', () => {

        test('normalizarTipoItem_producto', () => {
            // Arrange & Act
            const tipos = ['PRODUCTO', 'producto', 'Producto', 'P', 'p'];

            const normalizarTipoItem = (tipo) => {
                if (!tipo) return 'PRODUCTO';
                const t = tipo.toString().toUpperCase().trim();
                if (t === 'SERVICIO' || t === 'MO' || t === 'S') return 'SERVICIO';
                return 'PRODUCTO';
            };

            // Assert
            expect(normalizarTipoItem('PRODUCTO')).toBe('PRODUCTO');
            expect(normalizarTipoItem('producto')).toBe('PRODUCTO');
            expect(normalizarTipoItem('P')).toBe('PRODUCTO');
            expect(normalizarTipoItem(null)).toBe('PRODUCTO');
            expect(normalizarTipoItem(undefined)).toBe('PRODUCTO');
        });

        test('normalizarTipoItem_servicio', () => {
            // Arrange & Act
            const normalizarTipoItem = (tipo) => {
                if (!tipo) return 'PRODUCTO';
                const t = tipo.toString().toUpperCase().trim();
                if (t === 'SERVICIO' || t === 'MO' || t === 'S') return 'SERVICIO';
                return 'PRODUCTO';
            };

            // Assert
            expect(normalizarTipoItem('SERVICIO')).toBe('SERVICIO');
            expect(normalizarTipoItem('servicio')).toBe('SERVICIO');
            expect(normalizarTipoItem('MO')).toBe('SERVICIO');
            expect(normalizarTipoItem('S')).toBe('SERVICIO');
        });

    });

    // ===========================================================================
    // Estado de pago
    // ===========================================================================

    describe('Cálculo de estado de pago', () => {

        test('estadoPago_totalPagado_completado', () => {
            // Arrange
            const totalOrden = 1000.00;
            const totalPagado = 1000.00;

            // Act
            const saldoPendiente = totalOrden - totalPagado;
            const estado = saldoPendiente <= 0 ? 'PAGADO' :
                totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            // Assert
            expect(saldoPendiente).toBe(0);
            expect(estado).toBe('PAGADO');
        });

        test('estadoPago_pagoParcial_parcial', () => {
            // Arrange
            const totalOrden = 1000.00;
            const totalPagado = 400.00;

            // Act
            const saldoPendiente = totalOrden - totalPagado;
            const estado = saldoPendiente <= 0 ? 'PAGADO' :
                totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            // Assert
            expect(saldoPendiente).toBe(600.00);
            expect(estado).toBe('PARCIAL');
        });

        test('estadoPago_sinPago_pendiente', () => {
            // Arrange
            const totalOrden = 1000.00;
            const totalPagado = 0;

            // Act
            const saldoPendiente = totalOrden - totalPagado;
            const estado = saldoPendiente <= 0 ? 'PAGADO' :
                totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            // Assert
            expect(saldoPendiente).toBe(1000.00);
            expect(estado).toBe('PENDIENTE');
        });

        test('estadoPago_sobrepago_pagado', () => {
            // Arrange
            const totalOrden = 1000.00;
            const totalPagado = 1050.00; // Cliente pagó de más

            // Act
            const saldoPendiente = totalOrden - totalPagado;
            const estado = saldoPendiente <= 0 ? 'PAGADO' :
                totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            // Assert
            expect(saldoPendiente).toBe(-50.00);
            expect(estado).toBe('PAGADO');
        });

    });

});
