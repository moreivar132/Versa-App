# Guía de Conciliación Bancaria - Versa

Este documento explica cómo funciona el proceso de conciliación dentro de Versa para mantener tu contabilidad al día con tus movimientos bancarios.

## 1. El Concepto
La conciliación es el proceso de **emparejar** un movimiento real de tu banco (un cargo o un abono) con un documento justificativo en Versa (una Factura de Gasto o de Ingreso).

## 2. El Flujo de Trabajo

### Paso A: Importación
Los movimientos llegan a Versa de dos formas:
1. **Conexión Automática**: Vía Open Banking (TrueLayer).
2. **Importación Manual**: Subiendo un extracto en CSV o Excel.

Todos los movimientos nuevos aparecen con el estado `PENDIENTE`.

### Paso B: El Asistente de Conciliación
En la pantalla de **Bancos**, al hacer clic en el icono de enlace (🔗):
1. **Detección de Signo**: El sistema detecta si el dinero sale o entra.
   - **Salida (-)**: Te sugiere Facturas de Gasto pendientes.
   - **Entrada (+)**: Te sugiere Facturas de Ingreso pendientes.
2. **Selección Multidocumento**: Puedes seleccionar varias facturas para un solo movimiento (ej: un pago global a un proveedor que cubre tres facturas distintas).
3. **Validación de Importe**: El sistema te indica la diferencia entre el total del banco y el total de las facturas seleccionadas.

### Paso C: Resultado
Al confirmar:
- El movimiento bancario pasa a estado `CONCILIADO`.
- Se crean automáticamente los **registros de pago** en la contabilidad.
- Las facturas seleccionadas cambian su estado a `PAGADA`.

## 3. Beneficios
- **Control Real**: Sabes exactamente qué facturas han sido cobradas/pagadas y cuáles no.
- **Automatización**: No tienes que ir factura por factura marcándolas como pagadas.
- **Trazabilidad**: Cada movimiento contable queda vinculado al ID de la transacción bancaria original.

---
*Próximamente: Sugerencias automáticas por IA basadas en el concepto del movimiento.*
