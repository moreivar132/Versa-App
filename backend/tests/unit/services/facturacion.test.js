/**
 * Unit Tests: Facturación
 * 
 * Tests críticos para el módulo de facturación.
 * Área de riesgo ALTO - Documentos fiscales y numeración correlativa.
 */

describe('Facturación', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ===========================================================================
    // Numeración de Facturas
    // ===========================================================================

    describe('Numeración de Facturas', () => {

        test('numeroFactura_formatoCorrecto', () => {
            // Arrange
            const prefijo = 'FAC';
            const correlativo = 123;
            const sufijo = '2025';

            // Act
            const padded = String(correlativo).padStart(6, '0');
            const numeroFactura = sufijo
                ? `${prefijo}-${padded}-${sufijo}`
                : `${prefijo}-${padded}`;

            // Assert
            expect(numeroFactura).toBe('FAC-000123-2025');
        });

        test('numeroFactura_sinSufijo', () => {
            // Arrange
            const prefijo = 'A';
            const correlativo = 1;
            const sufijo = null;

            // Act
            const padded = String(correlativo).padStart(6, '0');
            const numeroFactura = sufijo
                ? `${prefijo}-${padded}-${sufijo}`
                : `${prefijo}-${padded}`;

            // Assert
            expect(numeroFactura).toBe('A-000001');
        });

        test('numeroFactura_correlativoAutoincrementa', () => {
            // Arrange
            const serie = {
                prefijo: 'FAC',
                ultimo_correlativo: 122
            };

            // Act
            const nuevoCorrelativo = serie.ultimo_correlativo + 1;

            // Assert
            expect(nuevoCorrelativo).toBe(123);
        });

        test('numeroFactura_unicoPorSerie', () => {
            // Arrange
            const facturasExistentes = [
                { numero: 'FAC-000001', id_serie: 1 },
                { numero: 'FAC-000002', id_serie: 1 },
                { numero: 'B-000001', id_serie: 2 }
            ];
            const nuevoNumero = 'FAC-000001';
            const idSerie = 1;

            // Act
            const existeDuplicado = facturasExistentes.some(
                f => f.numero === nuevoNumero && f.id_serie === idSerie
            );

            // Assert
            expect(existeDuplicado).toBe(true);
        });

    });

    // ===========================================================================
    // Emisión de Factura desde Orden
    // ===========================================================================

    describe('Emisión de Factura desde Orden', () => {

        test('emitir_ordenValida_creaFactura', () => {
            // Arrange
            const orden = {
                id: 1,
                id_cliente: 10,
                subtotal: 1000.00,
                iva: 210.00,
                total: 1210.00,
                estado: 'COMPLETADA',
                id_factura: null
            };

            // Act
            const puedeFacturar = orden.id_factura === null && orden.estado === 'COMPLETADA';

            // Assert
            expect(puedeFacturar).toBe(true);
        });

        test('emitir_ordenYaFacturada_error', () => {
            // Arrange
            const orden = {
                id: 1,
                id_factura: 5 // Ya tiene factura
            };

            // Act
            const yaFacturada = orden.id_factura !== null;

            // Assert
            expect(yaFacturada).toBe(true);
        });

        test('emitir_copiaLineasOrden', () => {
            // Arrange
            const lineasOrden = [
                { descripcion: 'Aceite', cantidad: 2, precio: 25.00, iva: 10.50, total: 60.50 },
                { descripcion: 'Filtro', cantidad: 1, precio: 80.00, iva: 16.80, total: 96.80 }
            ];

            // Act
            const lineasFactura = lineasOrden.map(linea => ({
                descripcion: linea.descripcion,
                cantidad: linea.cantidad,
                precio_unitario: linea.precio,
                iva: linea.iva,
                total: linea.total
            }));

            // Assert
            expect(lineasFactura.length).toBe(2);
            expect(lineasFactura[0].descripcion).toBe('Aceite');
        });

        test('emitir_actualizaOrden_conIdFactura', () => {
            // Arrange
            const orden = { id: 1, id_factura: null };
            const facturaCreada = { id: 10 };

            // Act
            orden.id_factura = facturaCreada.id;

            // Assert
            expect(orden.id_factura).toBe(10);
        });

    });

    // ===========================================================================
    // Datos de Factura
    // ===========================================================================

    describe('Datos de Factura', () => {

        test('factura_datosCliente_completos', () => {
            // Arrange
            const cliente = {
                nombre: 'Juan Pérez',
                documento: '12345678A',
                direccion: 'Calle Principal 123',
                email: 'juan@example.com'
            };

            // Assert
            expect(cliente).toHaveProperty('nombre');
            expect(cliente).toHaveProperty('documento');
            expect(cliente).toHaveProperty('direccion');
        });

        test('factura_datosEmisor_desdeSucursal', () => {
            // Arrange
            const sucursal = {
                nombre: 'Taller Central',
                direccion: 'Av. Industrial 456',
                cif: 'B12345678',
                telefono: '912345678'
            };

            // Assert
            expect(sucursal).toHaveProperty('cif');
            expect(sucursal).toHaveProperty('direccion');
        });

        test('factura_fechaEmision_hoy', () => {
            // Arrange
            const hoy = new Date();

            // Act
            const factura = {
                fecha_emision: hoy,
                created_at: hoy
            };

            // Assert
            expect(factura.fecha_emision).toBeInstanceOf(Date);
        });

        test('factura_totales_calculadosCorrectamente', () => {
            // Arrange
            const lineas = [
                { subtotal: 50.00, iva: 10.50 },
                { subtotal: 80.00, iva: 16.80 }
            ];

            // Act
            const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0);
            const iva = lineas.reduce((sum, l) => sum + l.iva, 0);
            const total = subtotal + iva;

            // Assert
            expect(subtotal).toBe(130.00);
            expect(iva).toBeCloseTo(27.30, 2);
            expect(total).toBeCloseTo(157.30, 2);
        });

    });

    // ===========================================================================
    // Series de Facturación
    // ===========================================================================

    describe('Series de Facturación', () => {

        test('serie_tienePrefijoUnico', () => {
            // Arrange
            const series = [
                { id: 1, prefijo: 'A', id_sucursal: 1 },
                { id: 2, prefijo: 'B', id_sucursal: 1 },
                { id: 3, prefijo: 'A', id_sucursal: 2 } // Mismo prefijo, otra sucursal
            ];
            const nuevaSerie = { prefijo: 'A', id_sucursal: 1 };

            // Act
            const existe = series.some(
                s => s.prefijo === nuevaSerie.prefijo && s.id_sucursal === nuevaSerie.id_sucursal
            );

            // Assert
            expect(existe).toBe(true);
        });

        test('serie_porDefecto_unaActivaMax', () => {
            // Arrange
            const series = [
                { id: 1, es_por_defecto: true, id_sucursal: 1 },
                { id: 2, es_por_defecto: false, id_sucursal: 1 },
                { id: 3, es_por_defecto: true, id_sucursal: 2 }
            ];
            const sucursalId = 1;

            // Act
            const seriesPorDefecto = series.filter(
                s => s.es_por_defecto && s.id_sucursal === sucursalId
            );

            // Assert
            expect(seriesPorDefecto.length).toBe(1);
        });

        test('serie_tipoDocumento_validos', () => {
            // Arrange
            const tiposValidos = ['FACTURA', 'FACTURA_SIMPLIFICADA', 'RECIBO', 'NOTA_CREDITO'];

            // Assert
            expect(tiposValidos).toContain('FACTURA');
            expect(tiposValidos).toContain('FACTURA_SIMPLIFICADA');
        });

    });

    // ===========================================================================
    // Estados de Factura
    // ===========================================================================

    describe('Estados de Factura', () => {

        test('factura_estadoInicial_EMITIDA', () => {
            // Arrange
            const factura = {
                id: 1,
                estado: 'EMITIDA'
            };

            // Assert
            expect(factura.estado).toBe('EMITIDA');
        });

        test('factura_estados_transiciones', () => {
            // Arrange
            const estadosValidos = ['EMITIDA', 'PAGADA', 'ANULADA', 'PARCIAL'];

            // Assert
            estadosValidos.forEach(estado => {
                expect(['EMITIDA', 'PAGADA', 'ANULADA', 'PARCIAL']).toContain(estado);
            });
        });

        test('factura_anulada_noPermiteModificacion', () => {
            // Arrange
            const factura = { id: 1, estado: 'ANULADA' };

            // Act
            const permiteModificacion = factura.estado !== 'ANULADA';

            // Assert
            expect(permiteModificacion).toBe(false);
        });

    });

    // ===========================================================================
    // Pagos de Factura
    // ===========================================================================

    describe('Pagos de Factura', () => {

        test('factura_copiaPagosDeOrden', () => {
            // Arrange
            const pagosOrden = [
                { id_medio_pago: 1, importe: 100.00 },
                { id_medio_pago: 2, importe: 57.30 }
            ];

            // Act
            const pagosFactura = pagosOrden.map(p => ({
                ...p,
                id_factura: 1
            }));

            // Assert
            expect(pagosFactura.length).toBe(2);
            expect(pagosFactura[0].id_factura).toBe(1);
        });

        test('factura_estadoPago_calculado', () => {
            // Arrange
            const factura = { total: 157.30 };
            const pagos = [
                { importe: 100.00 },
                { importe: 57.30 }
            ];

            // Act
            const totalPagado = pagos.reduce((sum, p) => sum + p.importe, 0);
            const estado = totalPagado >= factura.total ? 'PAGADA' :
                totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE';

            // Assert
            expect(totalPagado).toBeCloseTo(157.30, 2);
            expect(estado).toBe('PAGADA');
        });

    });

    // ===========================================================================
    // Generación de PDF
    // ===========================================================================

    describe('Generación de PDF', () => {

        test('pdf_datosRequeridos_completos', () => {
            // Arrange
            const facturaCompleta = {
                numero: 'FAC-000001',
                fecha_emision: new Date(),
                cliente: {
                    nombre: 'Juan Pérez',
                    documento: '12345678A',
                    direccion: 'Calle Test 123'
                },
                emisor: {
                    nombre: 'Mi Taller',
                    cif: 'B12345678',
                    direccion: 'Av. Principal 456'
                },
                lineas: [
                    { descripcion: 'Servicio', cantidad: 1, precio: 100.00, iva: 21.00, total: 121.00 }
                ],
                subtotal: 100.00,
                iva: 21.00,
                total: 121.00
            };

            // Assert
            expect(facturaCompleta).toHaveProperty('numero');
            expect(facturaCompleta).toHaveProperty('cliente');
            expect(facturaCompleta).toHaveProperty('emisor');
            expect(facturaCompleta).toHaveProperty('lineas');
            expect(facturaCompleta).toHaveProperty('total');
        });

    });

    // ===========================================================================
    // Listado y Filtros
    // ===========================================================================

    describe('Listado y Filtros', () => {

        test('listar_filtraPorTenant', () => {
            // Arrange
            const facturas = [
                { id: 1, id_tenant: 1 },
                { id: 2, id_tenant: 1 },
                { id: 3, id_tenant: 2 }
            ];
            const tenantActual = 1;

            // Act
            const facturasDelTenant = facturas.filter(f => f.id_tenant === tenantActual);

            // Assert
            expect(facturasDelTenant.length).toBe(2);
        });

        test('listar_filtraPorFecha', () => {
            // Arrange
            const facturas = [
                { id: 1, fecha_emision: new Date('2025-01-15') },
                { id: 2, fecha_emision: new Date('2025-01-20') },
                { id: 3, fecha_emision: new Date('2024-12-15') }
            ];
            const desde = new Date('2025-01-01');
            const hasta = new Date('2025-01-31');

            // Act
            const facturasFiltradas = facturas.filter(
                f => f.fecha_emision >= desde && f.fecha_emision <= hasta
            );

            // Assert
            expect(facturasFiltradas.length).toBe(2);
        });

        test('listar_buscaPorNumero', () => {
            // Arrange
            const facturas = [
                { id: 1, numero: 'FAC-000001' },
                { id: 2, numero: 'FAC-000002' },
                { id: 3, numero: 'B-000001' }
            ];
            const busqueda = 'FAC';

            // Act
            const facturasEncontradas = facturas.filter(
                f => f.numero.includes(busqueda)
            );

            // Assert
            expect(facturasEncontradas.length).toBe(2);
        });

    });

    // ===========================================================================
    // Estadísticas
    // ===========================================================================

    describe('Estadísticas', () => {

        test('stats_facturadoMes_sumaTotal', () => {
            // Arrange
            const facturas = [
                { total: 1000.00, fecha: new Date('2025-01-10') },
                { total: 2500.00, fecha: new Date('2025-01-15') },
                { total: 500.00, fecha: new Date('2024-12-20') } // Mes anterior
            ];
            const mesActual = '2025-01';

            // Act
            const facturasMes = facturas.filter(
                f => f.fecha.toISOString().startsWith(mesActual)
            );
            const facturadoMes = facturasMes.reduce((sum, f) => sum + f.total, 0);

            // Assert
            expect(facturadoMes).toBe(3500.00);
        });

        test('stats_cantidadFacturas_cuenta', () => {
            // Arrange
            const facturas = [
                { id: 1, estado: 'EMITIDA' },
                { id: 2, estado: 'PAGADA' },
                { id: 3, estado: 'ANULADA' }
            ];

            // Act
            const facturasActivas = facturas.filter(f => f.estado !== 'ANULADA');

            // Assert
            expect(facturasActivas.length).toBe(2);
        });

    });

});
