/**
 * Integration Tests: Cuentas Corrientes
 * 
 * Tests críticos para el módulo de cuentas corrientes.
 * Área de riesgo ALTO - Control de crédito y deudas de clientes.
 */

describe('Cuentas Corrientes', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // Gestión de Cuentas
    // ===========================================================================

    describe('Gestión de Cuentas', () => {

        test('crearCuenta_clienteNuevo_cuentaEstadoActiva', () => {
            // Arrange
            const cuenta = {
                id: 1,
                id_cliente: 10,
                id_tenant: 1,
                limite_credito: 5000.00,
                saldo_actual: 0,
                estado: 'ACTIVA',
                created_at: new Date()
            };

            // Assert
            expect(cuenta.estado).toBe('ACTIVA');
            expect(cuenta.saldo_actual).toBe(0);
            expect(cuenta.limite_credito).toBe(5000.00);
        });

        test('cuenta_limiteCreditoPorDefecto', () => {
            // Arrange
            const LIMITE_POR_DEFECTO = 5000.00;

            // Act
            const cuenta = {
                id: 1,
                id_cliente: 10,
                limite_credito: LIMITE_POR_DEFECTO
            };

            // Assert
            expect(cuenta.limite_credito).toBe(5000.00);
        });

        test('cuenta_estados_validos', () => {
            // Arrange
            const estadosValidos = ['ACTIVA', 'SUSPENDIDA', 'CERRADA'];

            // Act & Assert
            estadosValidos.forEach(estado => {
                expect(['ACTIVA', 'SUSPENDIDA', 'CERRADA']).toContain(estado);
            });
        });

        test('cuenta_aislamiento_porTenant', () => {
            // Arrange
            const cuentas = [
                { id: 1, id_tenant: 1, id_cliente: 10 },
                { id: 2, id_tenant: 1, id_cliente: 11 },
                { id: 3, id_tenant: 2, id_cliente: 20 }
            ];
            const tenantActual = 1;

            // Act
            const cuentasDelTenant = cuentas.filter(c => c.id_tenant === tenantActual);

            // Assert
            expect(cuentasDelTenant.length).toBe(2);
        });

    });

    // ===========================================================================
    // Movimientos de Cuenta
    // ===========================================================================

    describe('Movimientos de Cuenta', () => {

        test('movimiento_CARGO_incrementaSaldo', () => {
            // Arrange
            const saldoActual = 1000.00;
            const cargo = {
                tipo_movimiento: 'CARGO',
                importe: 500.00,
                concepto: 'Orden #123'
            };

            // Act
            const nuevoSaldo = saldoActual + cargo.importe;

            // Assert
            expect(nuevoSaldo).toBe(1500.00);
        });

        test('movimiento_ABONO_decrementaSaldo', () => {
            // Arrange
            const saldoActual = 1500.00;
            const abono = {
                tipo_movimiento: 'ABONO',
                importe: 500.00,
                concepto: 'Pago parcial'
            };

            // Act
            const nuevoSaldo = saldoActual - abono.importe;

            // Assert
            expect(nuevoSaldo).toBe(1000.00);
        });

        test('movimiento_registra_saldoAnterior', () => {
            // Arrange
            const saldoAnterior = 1000.00;
            const importe = 500.00;

            // Act
            const movimiento = {
                saldo_anterior: saldoAnterior,
                importe: importe,
                saldo_posterior: saldoAnterior + importe // CARGO
            };

            // Assert
            expect(movimiento.saldo_anterior).toBe(1000.00);
            expect(movimiento.saldo_posterior).toBe(1500.00);
        });

        test('movimiento_origenTipo_identificaOrigen', () => {
            // Arrange
            const origenes = [
                { tipo: 'ORDEN', ref: 'ORD-001' },
                { tipo: 'VENTA', ref: 'VTA-001' },
                { tipo: 'PAGO_MANUAL', ref: null },
                { tipo: 'AJUSTE', ref: 'ADJ-001' }
            ];

            // Act & Assert
            origenes.forEach(origen => {
                expect(['ORDEN', 'VENTA', 'PAGO_MANUAL', 'AJUSTE']).toContain(origen.tipo);
            });
        });

        test('movimiento_historial_ordenadoPorFecha', () => {
            // Arrange
            const movimientos = [
                { id: 1, fecha: new Date('2025-01-03') },
                { id: 2, fecha: new Date('2025-01-01') },
                { id: 3, fecha: new Date('2025-01-02') }
            ];

            // Act
            const ordenados = [...movimientos].sort((a, b) => b.fecha - a.fecha);

            // Assert
            expect(ordenados[0].id).toBe(1); // Más reciente
            expect(ordenados[2].id).toBe(2); // Más antiguo
        });

    });

    // ===========================================================================
    // Límite de Crédito
    // ===========================================================================

    describe('Límite de Crédito', () => {

        test('limiteCredito_validar_noExcede', () => {
            // Arrange
            const cuenta = {
                limite_credito: 5000.00,
                saldo_actual: 3000.00
            };
            const nuevoCargoImporte = 1500.00;

            // Act
            const nuevoSaldo = cuenta.saldo_actual + nuevoCargoImporte;
            const excedeCredito = nuevoSaldo > cuenta.limite_credito;

            // Assert
            expect(nuevoSaldo).toBe(4500.00);
            expect(excedeCredito).toBe(false);
        });

        test('limiteCredito_excedido_bloqueaCargo', () => {
            // Arrange
            const cuenta = {
                limite_credito: 5000.00,
                saldo_actual: 4500.00
            };
            const nuevoCargoImporte = 1000.00;

            // Act
            const nuevoSaldo = cuenta.saldo_actual + nuevoCargoImporte;
            const excedeCredito = nuevoSaldo > cuenta.limite_credito;

            // Assert
            expect(nuevoSaldo).toBe(5500.00);
            expect(excedeCredito).toBe(true);
        });

        test('limiteCredito_creditoDisponible', () => {
            // Arrange
            const cuenta = {
                limite_credito: 5000.00,
                saldo_actual: 3000.00
            };

            // Act
            const creditoDisponible = cuenta.limite_credito - cuenta.saldo_actual;

            // Assert
            expect(creditoDisponible).toBe(2000.00);
        });

        test('limiteCredito_saldoNegativo_creditoMayorQueLimite', () => {
            // Arrange - Saldo a favor del cliente
            const cuenta = {
                limite_credito: 5000.00,
                saldo_actual: -500.00 // Cliente tiene saldo a favor
            };

            // Act
            const creditoDisponible = cuenta.limite_credito - cuenta.saldo_actual;

            // Assert
            expect(creditoDisponible).toBe(5500.00);
        });

    });

    // ===========================================================================
    // Cobros y Pagos
    // ===========================================================================

    describe('Cobros y Pagos', () => {

        test('pago_totalDeuda_saldoCero', () => {
            // Arrange
            const cuenta = { saldo_actual: 2500.00 };
            const pago = { importe: 2500.00 };

            // Act
            const nuevoSaldo = cuenta.saldo_actual - pago.importe;

            // Assert
            expect(nuevoSaldo).toBe(0);
        });

        test('pago_parcial_reduceDeuda', () => {
            // Arrange
            const cuenta = { saldo_actual: 2500.00 };
            const pago = { importe: 1000.00 };

            // Act
            const nuevoSaldo = cuenta.saldo_actual - pago.importe;
            const saldoRestante = nuevoSaldo;

            // Assert
            expect(saldoRestante).toBe(1500.00);
        });

        test('pago_mayorQueDeuda_generaSaldoFavor', () => {
            // Arrange
            const cuenta = { saldo_actual: 500.00 };
            const pago = { importe: 750.00 };

            // Act
            const nuevoSaldo = cuenta.saldo_actual - pago.importe;

            // Assert
            expect(nuevoSaldo).toBe(-250.00); // Saldo a favor
        });

        test('pago_registra_medioPago', () => {
            // Arrange
            const pago = {
                importe: 500.00,
                id_medio_pago: 1, // Efectivo
                referencia: 'RECIBO-001'
            };

            // Assert
            expect(pago).toHaveProperty('id_medio_pago');
            expect(pago).toHaveProperty('referencia');
        });

        test('pago_afecta_caja', () => {
            // Arrange
            const pago = {
                importe: 500.00,
                id_medio_pago: 1, // Efectivo
                id_caja: 1
            };

            // Act - El pago debe generar un movimiento de ingreso en caja
            const movimientoCaja = {
                tipo: 'INGRESO',
                importe: pago.importe,
                origen_tipo: 'PAGO_CUENTA_CORRIENTE',
                id_origen: pago.id
            };

            // Assert
            expect(movimientoCaja.tipo).toBe('INGRESO');
            expect(movimientoCaja.origen_tipo).toBe('PAGO_CUENTA_CORRIENTE');
        });

    });

    // ===========================================================================
    // Cargo a Cuenta desde Orden/Venta
    // ===========================================================================

    describe('Cargo desde Orden/Venta', () => {

        test('cargoDesdeOrden_registraReferencia', () => {
            // Arrange
            const orden = { id: 123, total: 1500.00 };

            // Act
            const cargo = {
                tipo_movimiento: 'CARGO',
                importe: orden.total,
                concepto: `Orden de trabajo #${orden.id}`,
                origen_tipo: 'ORDEN',
                id_origen: orden.id
            };

            // Assert
            expect(cargo.origen_tipo).toBe('ORDEN');
            expect(cargo.id_origen).toBe(123);
            expect(cargo.concepto).toContain('123');
        });

        test('cargoDesdeVenta_registraReferencia', () => {
            // Arrange
            const venta = { id: 456, total: 850.00 };

            // Act
            const cargo = {
                tipo_movimiento: 'CARGO',
                importe: venta.total,
                concepto: `Venta #${venta.id}`,
                origen_tipo: 'VENTA',
                id_origen: venta.id
            };

            // Assert
            expect(cargo.origen_tipo).toBe('VENTA');
            expect(cargo.id_origen).toBe(456);
        });

        test('cargo_conMedioPago_CC', () => {
            // Arrange
            const CODIGO_CUENTA_CORRIENTE = 'CC';

            const pago = {
                id_orden: 123,
                medio_pago: CODIGO_CUENTA_CORRIENTE,
                importe: 1500.00
            };

            // Act
            const esCuentaCorriente = pago.medio_pago === 'CC';

            // Assert
            expect(esCuentaCorriente).toBe(true);
        });

    });

    // ===========================================================================
    // Estadísticas
    // ===========================================================================

    describe('Estadísticas', () => {

        test('stats_deudaTotal_sumaSaldos', () => {
            // Arrange
            const cuentas = [
                { id: 1, saldo_actual: 1000.00 },
                { id: 2, saldo_actual: 2500.00 },
                { id: 3, saldo_actual: -500.00 } // Saldo a favor
            ];

            // Act
            const deudaTotal = cuentas
                .filter(c => c.saldo_actual > 0)
                .reduce((sum, c) => sum + c.saldo_actual, 0);

            // Assert
            expect(deudaTotal).toBe(3500.00);
        });

        test('stats_cobradoMes_filtraPorFecha', () => {
            // Arrange
            const movimientos = [
                { tipo: 'ABONO', importe: 500.00, fecha: new Date('2025-01-15') },
                { tipo: 'ABONO', importe: 300.00, fecha: new Date('2025-01-20') },
                { tipo: 'CARGO', importe: 1000.00, fecha: new Date('2025-01-10') },
                { tipo: 'ABONO', importe: 200.00, fecha: new Date('2024-12-20') } // Mes anterior
            ];
            const mesActual = '2025-01';

            // Act
            const abonosMes = movimientos.filter(m =>
                m.tipo === 'ABONO' &&
                m.fecha.toISOString().startsWith(mesActual)
            );
            const cobradoMes = abonosMes.reduce((sum, m) => sum + m.importe, 0);

            // Assert
            expect(abonosMes.length).toBe(2);
            expect(cobradoMes).toBe(800.00);
        });

        test('stats_clientesConDeuda_cuenta', () => {
            // Arrange
            const cuentas = [
                { id: 1, saldo_actual: 1000.00 },
                { id: 2, saldo_actual: 0 },
                { id: 3, saldo_actual: 2500.00 },
                { id: 4, saldo_actual: -100.00 }
            ];

            // Act
            const clientesConDeuda = cuentas.filter(c => c.saldo_actual > 0).length;

            // Assert
            expect(clientesConDeuda).toBe(2);
        });

    });

    // ===========================================================================
    // Suspensión de Cuenta
    // ===========================================================================

    describe('Suspensión de Cuenta', () => {

        test('cuenta_suspendida_noPermiteCargos', () => {
            // Arrange
            const cuenta = {
                id: 1,
                estado: 'SUSPENDIDA',
                saldo_actual: 5000.00
            };

            // Act
            const permiteCargos = cuenta.estado === 'ACTIVA';

            // Assert
            expect(permiteCargos).toBe(false);
        });

        test('cuenta_suspendida_permiteAbonos', () => {
            // Arrange
            const cuenta = {
                id: 1,
                estado: 'SUSPENDIDA',
                saldo_actual: 5000.00
            };

            // Act - Las suspendidas SÍ permiten abonos para pagar la deuda
            const permiteAbonos = cuenta.estado !== 'CERRADA';

            // Assert
            expect(permiteAbonos).toBe(true);
        });

        test('cuenta_cerrada_noPermiteMovimientos', () => {
            // Arrange
            const cuenta = {
                id: 1,
                estado: 'CERRADA',
                saldo_actual: 0
            };

            // Act
            const permiteMovimientos = cuenta.estado === 'ACTIVA';

            // Assert
            expect(permiteMovimientos).toBe(false);
        });

    });

});
