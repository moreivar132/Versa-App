# 🧪 Test Suite - Versa-App

> **221 tests** implementados para validar áreas críticas del negocio.
> 
> Última actualización: Enero 2026

---

## 📋 Resumen Ejecutivo

### Por Ubicación

| Ubicación | Tests | Descripción |
|-----------|-------|-------------|
| **🔧 Backend** | 188 | Lógica de negocio, APIs, base de datos |
| **🖥️ Frontend** | 33 | Protección de páginas, autenticación UI |
| **TOTAL** | **221** | **✅ All Passed** |

### Por Área de Negocio

| Área | Backend | Frontend | Total |
|------|---------|----------|-------|
| Pagos | 40 | - | 40 |
| Caja | 20 | - | 20 |
| Órdenes | 18 | - | 18 |
| Ventas | 11 | - | 11 |
| Inventario | 12 | - | 12 |
| Compras | 11 | - | 11 |
| Autenticación | 24 | 33 | 57 |
| Cuentas Corrientes | 28 | - | 28 |
| Facturación | 24 | - | 24 |
| **TOTAL** | **188** | **33** | **221** |

---

## 🚀 Comandos

```bash
npm test              # Todos los tests (221)
npm run test:critical # Tests críticos (89)
npm run test:watch    # Modo desarrollo
npm run test:coverage # Con cobertura
```

---

## 📁 Estructura de Tests

```
backend/tests/
├── fixtures/                    # Datos de prueba
│   ├── ordenes.fixture.js
│   ├── pagos.fixture.js
│   └── productos.fixture.js
├── unit/                        # Tests unitarios
│   ├── services/
│   │   ├── ordenPagoService.test.js    (23 tests)
│   │   ├── ordenesService.test.js      (18 tests)
│   │   ├── ventasService.test.js       (11 tests)
│   │   ├── auth.test.js                (24 tests)
│   │   └── facturacion.test.js         (24 tests)
│   └── repositories/
│       └── ordenPagoRepository.test.js (17 tests)
└── integration/                 # Tests de integración
    ├── caja.test.js             (20 tests)
    ├── inventory.test.js        (12 tests)
    ├── compras.test.js          (11 tests)
    ├── cuentasCorrientes.test.js (28 tests)
    └── frontend-auth.test.js    (33 tests) ← Validación Frontend
```

---
---

# � TESTS DE BACKEND (188 tests)

> Estos tests validan la lógica de negocio, servicios, repositorios y APIs del servidor.

---

## 🔴 Pagos - RIESGO ALTO (40 tests)

### `ordenPagoService.test.js` - 23 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `registrarPago_sinIdOrden_lanzaError400` | ID de orden requerido |
| 2 | `registrarPago_idOrdenUndefined_lanzaError400` | ID undefined rechazado |
| 3 | `registrarPago_importeNull_lanzaError400` | Importe null rechazado |
| 4 | `registrarPago_importeUndefined_lanzaError400` | Importe undefined rechazado |
| 5 | `registrarPago_importeVacio_lanzaError400` | Importe vacío rechazado |
| 6 | `registrarPago_importeCero_lanzaError400` | No permite pagos de $0 |
| 7 | `registrarPago_importeNegativo_lanzaError400` | No permite pagos negativos |
| 8 | `registrarPago_importeNoNumerico_lanzaError400` | Solo acepta números |
| 9 | `registrarPago_sinMedioPago_lanzaError400` | Medio de pago requerido |
| 10 | `registrarPago_ordenNoExiste_lanzaError404` | Orden debe existir |
| 11 | `registrarPago_medioPagoInvalido_lanzaError404` | Medio de pago debe existir |
| 12 | `registrarPago_cajaNoExiste_lanzaError400` | Caja especificada debe existir |
| 13 | `registrarPago_conDatosValidos_creaPago` | Crea pago correctamente |
| 14 | `registrarPago_conMedioPagoPorCodigo_resuelveCorrectamente` | Resuelve código (CASH, CARD) |
| 15 | `registrarPago_conMedioPagoPorId_resuelveCorrectamente` | Resuelve por ID numérico |
| 16 | `registrarPago_sinCaja_detectaCajaAbierta` | Usa caja abierta existente |
| 17 | `registrarPago_sinCaja_creaNuevaCaja` | Crea caja si no hay abierta |
| 18 | `registrarPago_errorEnInsercion_haceRollback` | Rollback en error |
| 19 | `registrarPago_exitoso_siempreLiberaCliente` | Libera conexión DB |
| 20 | `registrarPago_error_siempreLiberaCliente` | Libera conexión en error |
| 21 | `registrarPago_importeDecimal_proceseCorrectamente` | Acepta decimales (123.45) |
| 22 | `registrarPago_importeComoString_convierteANumero` | Convierte "500.50" a número |
| 23 | `registrarPago_referenciaNull_proceseCorrectamente` | Referencia opcional |

### `ordenPagoRepository.test.js` - 17 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `existeOrden_ordenExiste_retornaTrue` | Verifica orden existente |
| 2 | `existeOrden_ordenNoExiste_retornaFalse` | Verifica orden inexistente |
| 3 | `obtenerDatosOrden_ordenExiste_retornaDatos` | Retorna id y sucursal |
| 4 | `obtenerDatosOrden_ordenNoExiste_retornaUndefined` | Undefined si no existe |
| 5 | `obtenerMedioPagoPorCodigo_existe_retornaMedioPago` | Busca por código (CASH) |
| 6 | `obtenerMedioPagoPorId_existe_retornaMedioPago` | Busca por ID (1) |
| 7 | `obtenerMedioPagoPorCodigo_noExiste_retornaNull` | Null si no existe |
| 8 | `obtenerMedioPagoPorCodigo_caseInsensitive_funciona` | cash = CASH |
| 9 | `obtenerMedioPagoPorId_idString_detectaComoNumero` | "1" detectado como ID |
| 10 | `existeCaja_cajaExiste_retornaTrue` | Verifica caja existente |
| 11 | `existeCaja_cajaNoExiste_retornaFalse` | Verifica caja inexistente |
| 12 | `insertarPagoOrden_datosValidos_insertaRegistro` | INSERT correcto |
| 13 | `insertarPagoOrden_conClienteTransaccion_usaCliente` | Usa cliente de transacción |
| 14 | `insertarPagoOrden_sinReferencia_insertaNull` | Referencia null válida |
| 15 | `obtenerPagosPorOrden_conPagos_retornaArray` | Lista pagos con JOIN |
| 16 | `obtenerPagosPorOrden_sinPagos_retornaArrayVacio` | Array vacío si no hay |
| 17 | `obtenerTodosMediosPago_retornaLista` | Lista todos los medios |

---

## 🔴 Caja - RIESGO ALTO (20 tests)

### `caja.test.js` - 20 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `estadoActual_saldoAperturaCorrecto` | Saldo apertura = 1000 |
| 2 | `estadoActual_calculaTotalIngresos` | Suma ingresos y egresos |
| 3 | `estadoActual_efectivoEsperado_incluyeTodosOrigenes` | Incluye ordenes, compras, movimientos |
| 4 | `movimiento_INGRESO_incrementaSaldoEsperado` | +500 = 2500 |
| 5 | `movimiento_EGRESO_decrementaSaldoEsperado` | -300 = 1700 |
| 6 | `movimiento_validacion_tipoRequerido` | Tipo obligatorio |
| 7 | `movimiento_validacion_importePositivo` | Importe > 0 |
| 8 | `movimiento_registra_metadatos` | Registra created_by, fecha |
| 9 | `cerrarCaja_calculaDiferenciaPositiva` | Sobrante detectado (+50) |
| 10 | `cerrarCaja_calculaDiferenciaNegativa` | Faltante detectado (-50) |
| 11 | `cerrarCaja_cuadreExacto` | Diferencia = 0 |
| 12 | `cerrarCaja_actualizaEstado` | Estado -> CERRADA |
| 13 | `cerrarCaja_creaAperturaParaSiguiente` | Saldo para siguiente caja |
| 14 | `efectivoEsperado_calculoCompleto` | Fórmula completa |
| 15 | `efectivoEsperado_noIncluyePagosTarjeta` | Solo efectivo |
| 16 | `resultadoPeriodo_ingresosMayorQueEgresos` | Ganancia |
| 17 | `resultadoPeriodo_egresosMayorQueIngresos` | Pérdida |
| 18 | `resultadoPeriodo_cero` | Sin movimiento |
| 19 | `formatCurrency_numeroPositivo` | 1,234.56 |
| 20 | `formatCurrency_cero` | 0.00 |

---

## 🔴 Órdenes - RIESGO ALTO (18 tests)

### `ordenesService.test.js` - 18 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `createOrden_calculaTotalCorrecto_lineaSimple` | 2 x 25 + 21% IVA = 60.50 |
| 2 | `createOrden_aplicaDescuentoLinea_calculaCorrecto` | 100 - 15% + 21% IVA = 102.85 |
| 3 | `createOrden_multipleLineas_sumaTotales` | Suma todas las líneas |
| 4 | `createOrden_diferentesIVA_calculaCadaUno` | 21%, 10%, 0% |
| 5 | `createOrden_descontaStock_productosAfectados` | Solo productos, no servicios |
| 6 | `createOrden_servicios_noDescontanStock` | Servicios sin stock |
| 7 | `updateOrden_recalculaTotalAlAgregarLinea` | Suma nueva línea |
| 8 | `updateOrden_recalculaTotalAlQuitarLinea` | Resta línea eliminada |
| 9 | `updateOrden_aumentaCantidad_descontaDiferencia` | 2→5 = descuenta 3 |
| 10 | `updateOrden_reduceCantidad_devuelveDiferencia` | 5→2 = devuelve 3 |
| 11 | `updateOrden_sinCambioCantidad_stockIgual` | Sin cambio |
| 12 | `updateOrden_eliminaLinea_devuelveTodoElStock` | Devuelve cantidad completa |
| 13 | `normalizarTipoItem_producto` | PRODUCTO, producto, P → PRODUCTO |
| 14 | `normalizarTipoItem_servicio` | SERVICIO, MO, S → SERVICIO |
| 15 | `estadoPago_totalPagado_completado` | 1000/1000 = PAGADO |
| 16 | `estadoPago_pagoParcial_parcial` | 400/1000 = PARCIAL |
| 17 | `estadoPago_sinPago_pendiente` | 0/1000 = PENDIENTE |
| 18 | `estadoPago_sobrepago_pagado` | 1050/1000 = PAGADO |

---

## 🔴 Ventas - RIESGO ALTO (11 tests)

### `ventasService.test.js` - 11 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `createVenta_calculaTotalCorrecto` | Subtotal + IVA |
| 2 | `createVenta_conDescuento_calculaCorrectamente` | Con 10% descuento |
| 3 | `createVenta_multipleLineas_sumaTotales` | Suma líneas |
| 4 | `createVenta_descontaStock_calculaDiferenciaCorrecta` | 50 - 3 = 47 |
| 5 | `createVenta_stockInsuficiente_detectaCorrectamente` | stock < cantidad |
| 6 | `createVenta_registraPago_importeCorrecto` | Suma pagos = total |
| 7 | `createVenta_pagoInsuficiente_detectaSaldo` | Saldo pendiente |
| 8 | `anularVenta_devuelveStock_calculaCorrecto` | 47 + 3 = 50 |
| 9 | `anularVenta_multipleProductos_devuelveTodos` | Devuelve todos |
| 10 | `anularVenta_revierteCaja_montoNegativo` | Egreso de reversión |
| 11 | `getVentas_filtroFecha_formateaCorrecto` | Fechas válidas |

---

## 🟡 Inventario - RIESGO MEDIO (12 tests)

### `inventory.test.js` - 12 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `GET_productos_filtraPorTenant` | Aislamiento por tenant |
| 2 | `POST_producto_validaCodigoUnico` | Código barras único |
| 3 | `movimientoEntrada_actualizaStockPositivo` | +20 unidades |
| 4 | `movimientoSalida_actualizaStockNegativo` | -5 unidades |
| 5 | `movimientoAjuste_puedeSerPositivoONegativo` | Ajustes ± |
| 6 | `stockBajo_detectaProductosBajoMinimo` | stock < mínimo |
| 7 | `stockBajo_noIncluirProductosInactivos` | Solo activos |
| 8 | `stockBajo_calculaPorcentajeRestock` | Cantidad sugerida |
| 9 | `valoracion_calculaPorProducto` | stock × precio |
| 10 | `valoracion_totalInventario` | Suma total |
| 11 | `historial_registraTodosLosTipos` | Entradas y salidas |
| 12 | `historial_calculaStockActual` | Stock = Σ entradas - Σ salidas |

---

## 🟡 Compras - RIESGO MEDIO (11 tests)

### `compras.test.js` - 11 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `POST_compra_incrementaStock` | +20 → 70 |
| 2 | `compra_multipleLineas_incrementaTodos` | Todos los productos |
| 3 | `POST_compra_calculaIVACorrecto` | 150 + 21% = 181.50 |
| 4 | `compra_diferentesIVA_calculaCadaLinea` | 21%, 10%, 0% |
| 5 | `compra_ivaDeducible_calculaCorrecto` | IVA soportado |
| 6 | `POST_compra_asociaProveedor` | Link con proveedor |
| 7 | `compra_sinProveedor_permitido` | Proveedor opcional |
| 8 | `compra_actualizaPrecioCosto` | Nuevo precio compra |
| 9 | `compra_calculaCostoPromedio` | Promedio ponderado |
| 10 | `compra_pagoEfectivo_registraEnCaja` | Egreso en caja |
| 11 | `compra_pagoCredito_noAfectaCajaInmediato` | Sin mov. inmediato |

---

## 🔴 Autenticación Backend - RIESGO ALTO (24 tests)

### `auth.test.js` - 24 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `register_sinEmail_lanzaError400` | Email requerido |
| 2 | `register_sinPassword_lanzaError400` | Password requerido |
| 3 | `register_emailInvalido_validacion` | Emails inválidos rechazados |
| 4 | `register_emailValido_pasa` | Emails válidos aceptados |
| 5 | `register_normalizaEmail_lowercase` | Convierte a minúsculas |
| 6 | `register_hashPassword_noGuardaPlainText` | Hash bcrypt |
| 7 | `register_usuarioExistente_lanzaError409` | Duplicado rechazado |
| 8 | `login_emailPasswordRequeridos` | Ambos campos obligatorios |
| 9 | `login_credencialesValidas_generaToken` | JWT generado |
| 10 | `login_passwordIncorrecto_noCoincide` | bcrypt compare false |
| 11 | `login_passwordCorrecto_coincide` | bcrypt compare true |
| 12 | `login_usuarioNoExiste_error401` | Usuario no encontrado |
| 13 | `jwt_payloadContieneIdUsuario` | ID en payload |
| 14 | `jwt_noIncluyePassword` | Password sanitizado |
| 15 | `jwt_expiraEn1Dia` | Expiración correcta |
| 16 | `jwt_tokenInvalido_lanzaError` | Token malformado |
| 17 | `jwt_tokenExpirado_lanzaError` | Token expirado |
| 18 | `middleware_sinToken_retorna401` | Token requerido |
| 19 | `middleware_tokenEnHeader_extraeCorrecto` | Bearer token |
| 20 | `middleware_formatoIncorrecto_sinBearer` | Formato inválido |
| 21 | `superAdmin_tieneAccesoTotal` | is_super_admin = true |
| 22 | `usuarioNormal_noEsSuperAdmin` | is_super_admin = false |
| 23 | `aislamiento_tenantId_requerido` | Multi-tenant |

---

## 🔴 Cuentas Corrientes - RIESGO ALTO (28 tests)

### `cuentasCorrientes.test.js` - 28 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `crearCuenta_clienteNuevo_cuentaEstadoActiva` | Estado inicial ACTIVA |
| 2 | `cuenta_limiteCreditoPorDefecto` | Límite = 5000 |
| 3 | `cuenta_estados_validos` | ACTIVA, SUSPENDIDA, CERRADA |
| 4 | `cuenta_aislamiento_porTenant` | Multi-tenant |
| 5 | `movimiento_CARGO_incrementaSaldo` | +500 al saldo |
| 6 | `movimiento_ABONO_decrementaSaldo` | -500 del saldo |
| 7 | `movimiento_registra_saldoAnterior` | Historial de saldos |
| 8 | `movimiento_origenTipo_identificaOrigen` | ORDEN, VENTA, PAGO |
| 9 | `movimiento_historial_ordenadoPorFecha` | Más reciente primero |
| 10 | `limiteCredito_validar_noExcede` | Permite cargo |
| 11 | `limiteCredito_excedido_bloqueaCargo` | Bloquea cargo |
| 12 | `limiteCredito_creditoDisponible` | Calcula disponible |
| 13 | `limiteCredito_saldoNegativo_creditoMayorQueLimite` | Saldo a favor |
| 14 | `pago_totalDeuda_saldoCero` | Saldo = 0 |
| 15 | `pago_parcial_reduceDeuda` | Reduce saldo |
| 16 | `pago_mayorQueDeuda_generaSaldoFavor` | Saldo negativo |
| 17 | `pago_registra_medioPago` | Medio de pago |
| 18 | `pago_afecta_caja` | Ingreso en caja |
| 19 | `cargoDesdeOrden_registraReferencia` | Ref: ORD-123 |
| 20 | `cargoDesdeVenta_registraReferencia` | Ref: VTA-456 |
| 21 | `cargo_conMedioPago_CC` | Código CC |
| 22 | `stats_deudaTotal_sumaSaldos` | Total deuda |
| 23 | `stats_cobradoMes_filtraPorFecha` | Cobros del mes |
| 24 | `stats_clientesConDeuda_cuenta` | Clientes con saldo |
| 25 | `cuenta_suspendida_noPermiteCargos` | Sin nuevos cargos |
| 26 | `cuenta_suspendida_permiteAbonos` | Permite pagos |
| 27 | `cuenta_cerrada_noPermiteMovimientos` | Bloqueada |

---

## 🔴 Facturación - RIESGO ALTO (24 tests)

### `facturacion.test.js` - 24 tests

| # | Test | Descripción |
|---|------|-------------|
| 1 | `numeroFactura_formatoCorrecto` | FAC-000123-2025 |
| 2 | `numeroFactura_sinSufijo` | A-000001 |
| 3 | `numeroFactura_correlativoAutoincrementa` | 122 → 123 |
| 4 | `numeroFactura_unicoPorSerie` | Sin duplicados |
| 5 | `emitir_ordenValida_creaFactura` | Orden completada |
| 6 | `emitir_ordenYaFacturada_error` | Ya tiene factura |
| 7 | `emitir_copiaLineasOrden` | Copia líneas |
| 8 | `emitir_actualizaOrden_conIdFactura` | Link orden-factura |
| 9 | `factura_datosCliente_completos` | Nombre, doc, dir |
| 10 | `factura_datosEmisor_desdeSucursal` | CIF, dirección |
| 11 | `factura_fechaEmision_hoy` | Fecha actual |
| 12 | `factura_totales_calculadosCorrectamente` | Sub + IVA = Total |
| 13 | `serie_tienePrefijoUnico` | Prefijo por sucursal |
| 14 | `serie_porDefecto_unaActivaMax` | Una por defecto |
| 15 | `serie_tipoDocumento_validos` | FACTURA, RECIBO... |
| 16 | `factura_estadoInicial_EMITIDA` | Estado inicial |
| 17 | `factura_estados_transiciones` | EMITIDA → PAGADA |
| 18 | `factura_anulada_noPermiteModificacion` | Bloqueada |
| 19 | `factura_copiaPagosDeOrden` | Pagos asociados |
| 20 | `factura_estadoPago_calculado` | Saldo pendiente |
| 21 | `pdf_datosRequeridos_completos` | All fields |
| 22 | `listar_filtraPorTenant` | Multi-tenant |
| 23 | `listar_filtraPorFecha` | Rango fechas |
| 24 | `listar_buscaPorNumero` | Búsqueda |

---
---

# 🖥️ TESTS DE FRONTEND (33 tests)

> Estos tests verifican que las páginas del frontend tienen la protección de autenticación correcta.

---

## 🔴 Protección de Páginas - RIESGO ALTO (33 tests)

### `frontend-auth.test.js` - 33 tests

#### Páginas protegidas tienen guard.js
| # | Test | Descripción |
|---|------|-------------|
| 1 | `manager-taller-inicio.html incluye guard.js` | Dashboard protegido |
| 2 | `manager-taller-ordenes.html incluye guard.js` | Crear orden protegido |
| 3 | `manager-taller-ordenes-lista.html incluye guard.js` | Lista órdenes protegida |
| 4 | `manager-taller-caja.html incluye guard.js` | Caja protegida |
| 5 | `manager-taller-inventario.html incluye guard.js` | Inventario protegido |
| 6 | `manager-taller-clientes.html incluye guard.js` | Clientes protegido |
| 7 | `manager-taller-vehiculos.html incluye guard.js` | Vehículos protegido |
| 8 | `manager-taller-facturas.html incluye guard.js` | Facturas protegido |
| 9 | `manager-taller-facturas-pendientes.html incluye guard.js` | Pendientes protegido |
| 10 | `manager-taller-config-facturas.html incluye guard.js` | Config protegido |
| 11 | `manager-taller-cuentas-corrientes.html incluye guard.js` | CC protegido |
| 12 | `manager-taller-compras.html incluye guard.js` | Compras protegido |
| 13 | `manager-taller-compras-historial.html incluye guard.js` | Historial compras protegido |
| 14 | `manager-taller-trabajadores.html incluye guard.js` | Trabajadores protegido |
| 15 | `manager-taller-ventas.html incluye guard.js` | Ventas protegido |
| 16 | `manager-taller-ventas-historial.html incluye guard.js` | Historial ventas protegido |
| 17 | `manager-taller-citas.html incluye guard.js` | Citas protegido |
| 18 | `manager-taller-proveedores.html incluye guard.js` | Proveedores protegido |
| 19 | `admin-accesos.html incluye guard.js` | Admin protegido |

#### Páginas públicas NO tienen redirección forzada
| # | Test | Descripción |
|---|------|-------------|
| 20 | `login.html es página pública` | Login accesible |
| 21 | `cita-previa.html es página pública` | Cita previa accesible |
| 22 | `portal-cliente.html es página pública` | Portal cliente accesible |
| 23 | `cliente-login.html es página pública` | Login cliente accesible |

#### guard.js tiene protección correcta
| # | Test | Descripción |
|---|------|-------------|
| 24 | `guard.js existe en public/` | Archivo existe |
| 25 | `guard.js verifica localStorage` | Fase 1: local |
| 26 | `guard.js hace validación con servidor` | Fase 2: /api/auth/me |
| 27 | `guard.js tiene lista de páginas públicas` | PUBLIC_PAGES |
| 28 | `guard.js maneja logout` | Event listener |

#### auth.js tiene funciones requeridas
| # | Test | Descripción |
|---|------|-------------|
| 29 | `auth.js existe` | Archivo existe |
| 30 | `auth.js exporta requireAuth` | Función disponible |
| 31 | `auth.js exporta getSession` | Función disponible |
| 32 | `auth.js exporta fetchWithAuth` | Función disponible |
| 33 | `auth.js maneja 401 en fetchWithAuth` | Redirige en 401 |

---
---

# ❌ Tests Pendientes (Por Implementar)

> Marcar con ✅ cuando se implementen

### Clientes
- [ ] CRUD de clientes
- [ ] Validación de datos (email, teléfono)
- [ ] Búsqueda de clientes
- [ ] Historial de cliente

### Vehículos
- [ ] CRUD de vehículos
- [ ] Asociación cliente-vehículo
- [ ] Historial de servicio

### Trabajadores
- [ ] CRUD de trabajadores
- [ ] Pagos a trabajadores
- [ ] Comisiones

### Reportes
- [ ] Reporte de ventas
- [ ] Reporte de caja
- [ ] Reporte de inventario
- [ ] Dashboard estadísticas

---

## 📝 Notas

### Cómo agregar nuevos tests

1. Crear archivo en `backend/tests/unit/` o `backend/tests/integration/`
2. Nombrar: `nombreModulo.test.js`
3. Seguir patrón AAA (Arrange-Act-Assert)
4. Usar fixtures de `backend/tests/fixtures/`
5. Actualizar este documento

### Ejemplo de test

```javascript
test('nombreMetodo_condicion_resultadoEsperado', () => {
    // Arrange
    const input = {...};
    
    // Act
    const result = funcion(input);
    
    // Assert
    expect(result).toBe(valorEsperado);
});
```

---

*Documento generado automáticamente. Mantener actualizado al agregar nuevos tests.*
