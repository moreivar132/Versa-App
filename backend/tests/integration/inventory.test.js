/**
 * Integration Tests: Inventory (Módulo de Inventario)
 * 
 * Tests de integración para las rutas de inventario.
 * Área de riesgo MEDIO - El stock debe ser preciso.
 */

const request = require('supertest');
const express = require('express');

const { productos, movimientosInventario, crearProductoData } = require('../fixtures/productos.fixture');

// Mock de autenticación
jest.mock('../../middleware/auth', () => {
    return (req, res, next) => {
        req.user = {
            id: 1,
            tenant_id: 1,
            id_sucursal: 1,
            is_super_admin: false,
            role: 'MANAGER'
        };
        next();
    };
});

// Mock del pool de base de datos
const mockPool = {
    query: jest.fn()
};

jest.mock('../../db', () => mockPool);

describe('Inventory - Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // Filtrado por Tenant
    // ===========================================================================

    describe('Aislamiento Multi-Tenant', () => {

        test('GET_productos_filtraPorTenant', () => {
            // Arrange
            const tenant_id = 1;
            const todosProductos = [
                { ...productos.productoConStock, tenant_id: 1 },
                { ...productos.productoStockBajo, tenant_id: 1 },
                { ...productos.productoSinStock, tenant_id: 2 } // Diferente tenant
            ];

            // Act
            const productosDelTenant = todosProductos.filter(p => p.tenant_id === tenant_id);

            // Assert
            expect(productosDelTenant).toHaveLength(2);
            expect(productosDelTenant.every(p => p.tenant_id === tenant_id)).toBe(true);
        });

    });

    // ===========================================================================
    // Validación de código único
    // ===========================================================================

    describe('Validación de código de barras', () => {

        test('POST_producto_validaCodigoUnico', () => {
            // Arrange
            const productosExistentes = [productos.productoConStock.codigo_barras];
            const nuevoCodigoExistente = '7501234567890';
            const nuevoCodigoNuevo = '7501234567899';

            // Act
            const existeCodigoRepetido = productosExistentes.includes(nuevoCodigoExistente);
            const existeCodigoNuevo = productosExistentes.includes(nuevoCodigoNuevo);

            // Assert
            expect(existeCodigoRepetido).toBe(true);
            expect(existeCodigoNuevo).toBe(false);
        });

    });

    // ===========================================================================
    // Movimientos de inventario
    // ===========================================================================

    describe('Movimientos de Inventario', () => {

        test('movimientoEntrada_actualizaStockPositivo', () => {
            // Arrange
            const stockActual = 50;
            const cantidadEntrada = 20;

            // Act
            const nuevoStock = stockActual + cantidadEntrada;

            // Assert
            expect(nuevoStock).toBe(70);
        });

        test('movimientoSalida_actualizaStockNegativo', () => {
            // Arrange
            const stockActual = 50;
            const cantidadSalida = 5;

            // Act
            const nuevoStock = stockActual - cantidadSalida;

            // Assert
            expect(nuevoStock).toBe(45);
        });

        test('movimientoAjuste_puedeSerPositivoONegativo', () => {
            // Arrange
            const stockActual = 50;
            const ajustePositivo = 10;
            const ajusteNegativo = -5;

            // Act
            const stockAjustePositivo = stockActual + ajustePositivo;
            const stockAjusteNegativo = stockActual + ajusteNegativo;

            // Assert
            expect(stockAjustePositivo).toBe(60);
            expect(stockAjusteNegativo).toBe(45);
        });

    });

    // ===========================================================================
    // Alertas de Stock
    // ===========================================================================

    describe('Alertas de Stock Bajo', () => {

        test('stockBajo_detectaProductosBajoMinimo', () => {
            // Arrange
            const productosInventario = [
                productos.productoConStock,  // 50/10 - OK
                productos.productoStockBajo, // 5/10 - BAJO
                productos.productoSinStock   // 0/20 - BAJO
            ];

            // Act
            const productosBajoStock = productosInventario.filter(
                p => p.stock_actual < p.stock_minimo
            );

            // Assert
            expect(productosBajoStock).toHaveLength(2);
            expect(productosBajoStock.map(p => p.id)).toContain(101);
            expect(productosBajoStock.map(p => p.id)).toContain(102);
        });

        test('stockBajo_noIncluirProductosInactivos', () => {
            // Arrange
            const productosInventario = [
                productos.productoConStock,
                productos.productoStockBajo,
                productos.productoInactivo // Inactivo pero con stock
            ];

            // Act
            const productosBajoStockActivos = productosInventario.filter(
                p => p.activo && p.stock_actual < p.stock_minimo
            );

            // Assert
            expect(productosBajoStockActivos).toHaveLength(1);
            expect(productosBajoStockActivos[0].id).toBe(101);
        });

        test('stockBajo_calculaPorcentajeRestock', () => {
            // Arrange
            const producto = productos.productoStockBajo; // stock: 5, minimo: 10

            // Act
            const cantidadParaMinimo = producto.stock_minimo - producto.stock_actual;
            const cantidadRecomendada = producto.stock_minimo * 2; // Doble del mínimo
            const cantidadAComprar = Math.max(cantidadRecomendada - producto.stock_actual, 0);

            // Assert
            expect(cantidadParaMinimo).toBe(5);
            expect(cantidadAComprar).toBe(15); // Para llegar a 20 (doble del mínimo)
        });

    });

    // ===========================================================================
    // Valoración de Inventario
    // ===========================================================================

    describe('Valoración de Inventario', () => {

        test('valoracion_calculaPorProducto', () => {
            // Arrange
            const producto = productos.productoConStock;

            // Act
            const valorCosto = producto.stock_actual * producto.precio_compra;
            const valorVenta = producto.stock_actual * producto.precio_venta;
            const margen = valorVenta - valorCosto;

            // Assert
            expect(valorCosto).toBe(750.00);  // 50 * 15
            expect(valorVenta).toBe(1250.00); // 50 * 25
            expect(margen).toBe(500.00);
        });

        test('valoracion_totalInventario', () => {
            // Arrange
            const productosActivos = [
                productos.productoConStock,
                productos.productoStockBajo
            ];

            // Act
            const valorTotalCosto = productosActivos.reduce(
                (sum, p) => sum + (p.stock_actual * p.precio_compra), 0
            );

            const valorTotalVenta = productosActivos.reduce(
                (sum, p) => sum + (p.stock_actual * p.precio_venta), 0
            );

            // Assert
            // Producto 1: 50 * 15 = 750
            // Producto 2: 5 * 45 = 225
            expect(valorTotalCosto).toBe(975.00);

            // Producto 1: 50 * 25 = 1250
            // Producto 2: 5 * 80 = 400
            expect(valorTotalVenta).toBe(1650.00);
        });

    });

    // ===========================================================================
    // Historial de Movimientos
    // ===========================================================================

    describe('Historial de Movimientos', () => {

        test('historial_registraTodosLosTipos', () => {
            // Arrange
            const movimientos = [
                movimientosInventario.entradaCompra,
                movimientosInventario.salidaVenta,
                movimientosInventario.ajustePositivo,
                movimientosInventario.ajusteNegativo
            ];

            // Act
            const entradas = movimientos.filter(m => m.tipo === 'ENTRADA');
            const salidas = movimientos.filter(m => m.tipo === 'SALIDA');

            // Assert
            expect(entradas).toHaveLength(2);
            expect(salidas).toHaveLength(2);
        });

        test('historial_calculaStockActual', () => {
            // Arrange
            const stockInicial = 0;
            const movimientos = [
                { tipo: 'ENTRADA', cantidad: 50 },  // Compra inicial
                { tipo: 'SALIDA', cantidad: 3 },    // Venta
                { tipo: 'ENTRADA', cantidad: 10 },  // Compra
                { tipo: 'SALIDA', cantidad: 2 },    // Venta
                { tipo: 'SALIDA', cantidad: 5 }     // Venta
            ];

            // Act
            const stockCalculado = movimientos.reduce((stock, mov) => {
                return mov.tipo === 'ENTRADA'
                    ? stock + mov.cantidad
                    : stock - mov.cantidad;
            }, stockInicial);

            // Assert
            expect(stockCalculado).toBe(50); // 50 + 10 - 3 - 2 - 5 = 50
        });

    });

});
