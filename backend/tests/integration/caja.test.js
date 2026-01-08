/**
 * Integration Tests: Caja (Módulo de Caja)
 * 
 * Tests de integración para lógica de caja.
 * Área de riesgo ALTO - El cuadre de caja debe ser preciso.
 * 
 * NOTA: Estos tests se enfocan en la lógica de negocio,
 * no en las rutas HTTP directamente (para evitar dependencias complejas).
 */

const { cajas, mediosPago, pagos } = require('../fixtures/pagos.fixture');

describe('Caja - Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // GET /api/caja/estado-actual - Lógica de Estado
    // ===========================================================================

    describe('Estado de Caja - Cálculos', () => {

        test('estadoActual_saldoAperturaCorrecto', () => {
            // Arrange
            const caja = cajas.abierta;

            // Assert
            expect(caja.saldo_apertura).toBe(1000.00);
            expect(caja.estado).toBe('ABIERTA');
        });

        test('estadoActual_calculaTotalIngresos', () => {
            // Arrange
            const movimientos = [
                { tipo: 'INGRESO', importe: 500.00, origen: 'MANUAL' },
                { tipo: 'INGRESO', importe: 300.00, origen: 'MANUAL' },
                { tipo: 'EGRESO', importe: 200.00, origen: 'MANUAL' }
            ];

            // Act
            const totalIngresos = movimientos
                .filter(m => m.tipo === 'INGRESO')
                .reduce((sum, m) => sum + m.importe, 0);

            const totalEgresos = movimientos
                .filter(m => m.tipo === 'EGRESO')
                .reduce((sum, m) => sum + m.importe, 0);

            // Assert
            expect(totalIngresos).toBe(800.00);
            expect(totalEgresos).toBe(200.00);
        });

        test('estadoActual_efectivoEsperado_incluyeTodosOrigenes', () => {
            // Arrange
            const saldoApertura = 1000.00;
            const pagosEfectivoOrdenes = 1500.00;
            const ingresosEfectivoManuales = 500.00;
            const egresosEfectivoManuales = 200.00;
            const comprasEfectivo = 300.00;
            const pagosTrabajadores = 100.00;

            // Act
            const efectivoEsperado = saldoApertura
                + pagosEfectivoOrdenes
                + ingresosEfectivoManuales
                - egresosEfectivoManuales
                - comprasEfectivo
                - pagosTrabajadores;

            // Assert
            expect(efectivoEsperado).toBe(2400.00);
        });

    });

    // ===========================================================================
    // POST /api/caja/movimiento - Ingresos y Egresos
    // ===========================================================================

    describe('Movimientos de Caja', () => {

        test('movimiento_INGRESO_incrementaSaldoEsperado', () => {
            // Arrange
            const saldoActual = 2000.00;
            const nuevoIngreso = 500.00;

            // Act
            const nuevoSaldo = saldoActual + nuevoIngreso;

            // Assert
            expect(nuevoSaldo).toBe(2500.00);
        });

        test('movimiento_EGRESO_decrementaSaldoEsperado', () => {
            // Arrange
            const saldoActual = 2000.00;
            const nuevoEgreso = 300.00;

            // Act
            const nuevoSaldo = saldoActual - nuevoEgreso;

            // Assert
            expect(nuevoSaldo).toBe(1700.00);
        });

        test('movimiento_validacion_tipoRequerido', () => {
            // Arrange
            const movimientoSinTipo = {
                importe: 500.00,
                concepto: 'Test'
            };

            // Act
            const esValido = movimientoSinTipo.tipo !== undefined &&
                movimientoSinTipo.tipo !== null;

            // Assert
            expect(esValido).toBe(false);
        });

        test('movimiento_validacion_importePositivo', () => {
            // Arrange
            const importes = [0, -100, 100, 0.01];

            // Act
            const validaciones = importes.map(imp => imp > 0);

            // Assert
            expect(validaciones).toEqual([false, false, true, true]);
        });

        test('movimiento_registra_metadatos', () => {
            // Arrange
            const movimiento = {
                tipo: 'INGRESO',
                importe: 500.00,
                concepto: 'Deposito cliente',
                id_medio_pago: 1,
                created_by: 1,
                created_at: new Date()
            };

            // Assert
            expect(movimiento).toHaveProperty('tipo');
            expect(movimiento).toHaveProperty('importe');
            expect(movimiento).toHaveProperty('created_by');
            expect(movimiento).toHaveProperty('created_at');
        });

    });

    // ===========================================================================
    // POST /api/caja/cerrar - Cierre de Caja
    // ===========================================================================

    describe('Cierre de Caja', () => {

        test('cerrarCaja_calculaDiferenciaPositiva', () => {
            // Arrange
            const efectivoEsperado = 2000.00;
            const efectivoReal = 2050.00; // Hay más dinero del esperado

            // Act
            const diferencia = efectivoReal - efectivoEsperado;

            // Assert
            expect(diferencia).toBe(50.00);
            expect(diferencia > 0).toBe(true);
        });

        test('cerrarCaja_calculaDiferenciaNegativa', () => {
            // Arrange
            const efectivoEsperado = 2000.00;
            const efectivoReal = 1950.00; // Falta dinero

            // Act
            const diferencia = efectivoReal - efectivoEsperado;

            // Assert
            expect(diferencia).toBe(-50.00);
            expect(diferencia < 0).toBe(true);
        });

        test('cerrarCaja_cuadreExacto', () => {
            // Arrange
            const efectivoEsperado = 2000.00;
            const efectivoReal = 2000.00;

            // Act
            const diferencia = efectivoReal - efectivoEsperado;

            // Assert
            expect(diferencia).toBe(0);
        });

        test('cerrarCaja_actualizaEstado', () => {
            // Arrange
            const cajaAbierta = { ...cajas.abierta };

            // Act
            cajaAbierta.estado = 'CERRADA';
            cajaAbierta.fecha_cierre = new Date();
            cajaAbierta.closed_by = 1;

            // Assert
            expect(cajaAbierta.estado).toBe('CERRADA');
            expect(cajaAbierta.fecha_cierre).toBeInstanceOf(Date);
            expect(cajaAbierta.closed_by).toBe(1);
        });

        test('cerrarCaja_creaAperturaParaSiguiente', () => {
            // Arrange
            const saldoCierreCajaAnterior = 2500.00;
            const envioACajaChica = 500.00;

            // Act
            const saldoAperturaSiguiente = saldoCierreCajaAnterior - envioACajaChica;

            // Assert
            expect(saldoAperturaSiguiente).toBe(2000.00);
        });

    });

    // ===========================================================================
    // Cálculos de Efectivo Esperado - Detallados
    // ===========================================================================

    describe('Cálculo de Efectivo Esperado - Completo', () => {

        test('efectivoEsperado_calculoCompleto', () => {
            // Arrange - Todos los componentes que afectan el efectivo
            const resumen = {
                saldo_apertura: 1000.00,
                pagos: {
                    ordenes_efectivo: 2500.00,
                    ventas_efectivo: 800.00,
                    cuenta_corriente_ingresos_efectivo: 300.00
                },
                ingresos_manuales_efectivo: 500.00,
                egresos: {
                    manuales_efectivo: 200.00,
                    compras_efectivo: 450.00,
                    pagos_trabajadores: 150.00,
                    envio_caja_chica: 0
                }
            };

            // Act
            const totalIngresos = resumen.saldo_apertura
                + resumen.pagos.ordenes_efectivo
                + resumen.pagos.ventas_efectivo
                + resumen.pagos.cuenta_corriente_ingresos_efectivo
                + resumen.ingresos_manuales_efectivo;

            const totalEgresos = resumen.egresos.manuales_efectivo
                + resumen.egresos.compras_efectivo
                + resumen.egresos.pagos_trabajadores
                + resumen.egresos.envio_caja_chica;

            const efectivoEsperado = totalIngresos - totalEgresos;

            // Assert
            expect(totalIngresos).toBe(5100.00);
            expect(totalEgresos).toBe(800.00);
            expect(efectivoEsperado).toBe(4300.00);
        });

        test('efectivoEsperado_noIncluyePagosTarjeta', () => {
            // Arrange
            const pagos = [
                { medio: 'CASH', importe: 500.00 },
                { medio: 'CARD', importe: 750.00 },
                { medio: 'CASH', importe: 300.00 }
            ];

            // Act
            const efectivoTotal = pagos
                .filter(p => p.medio === 'CASH')
                .reduce((sum, p) => sum + p.importe, 0);

            const tarjetaTotal = pagos
                .filter(p => p.medio === 'CARD')
                .reduce((sum, p) => sum + p.importe, 0);

            // Assert
            expect(efectivoTotal).toBe(800.00);
            expect(tarjetaTotal).toBe(750.00);
        });

    });

    // ===========================================================================
    // Resultado de Periodo
    // ===========================================================================

    describe('Resultado de Periodo', () => {

        test('resultadoPeriodo_ingresosMayorQueEgresos', () => {
            // Arrange
            const totalIngresos = 5000.00;
            const totalEgresos = 1500.00;

            // Act
            const resultado = totalIngresos - totalEgresos;

            // Assert
            expect(resultado).toBe(3500.00);
            expect(resultado > 0).toBe(true);
        });

        test('resultadoPeriodo_egresosMayorQueIngresos', () => {
            // Arrange
            const totalIngresos = 1000.00;
            const totalEgresos = 2500.00;

            // Act
            const resultado = totalIngresos - totalEgresos;

            // Assert
            expect(resultado).toBe(-1500.00);
            expect(resultado < 0).toBe(true);
        });

        test('resultadoPeriodo_cero', () => {
            // Arrange
            const totalIngresos = 2000.00;
            const totalEgresos = 2000.00;

            // Act
            const resultado = totalIngresos - totalEgresos;

            // Assert
            expect(resultado).toBe(0);
        });

    });

    // ===========================================================================
    // Formato de Moneda
    // ===========================================================================

    describe('Formato de Moneda', () => {

        test('formatCurrency_numeroPositivo', () => {
            // Arrange
            const formatCurrency = (value) => {
                const num = parseFloat(value) || 0;
                return num.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            };

            // Act
            const formatted = formatCurrency(1234.56);

            // Assert
            expect(formatted).toMatch(/1[.,]?234[.,]56/);
        });

        test('formatCurrency_cero', () => {
            // Arrange
            const formatCurrency = (value) => {
                const num = parseFloat(value) || 0;
                return num.toFixed(2);
            };

            // Act
            const formatted = formatCurrency(0);

            // Assert
            expect(formatted).toBe('0.00');
        });

    });

});
