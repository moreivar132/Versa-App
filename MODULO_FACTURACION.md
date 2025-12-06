# Módulo de Facturación - Versa SaaS Taller Mecánico

## 📋 Descripción General

Este módulo de facturación está diseñado para un SaaS multi-tenant de taller mecánico. Permite generar facturas desde órdenes de taller con numeración correlativa continua por serie/sucursal, personalización de diseño por tenant, y generación de PDFs.

## 🗂️ Estructura de la Base de Datos

### Tablas Creadas

#### 1. `facturaserie`
Control de series y numeración continua de facturas.

**Campos principales:**
- `id_sucursal`: Referencia a la sucursal
- `nombre_serie`: Nombre de la serie (ej: 'A', 'B', 'ONLINE')
- `prefijo`: Prefijo para el número de factura (ej: 'F', 'FV-')
- `sufijo`: Sufijo opcional
- `ultimo_numero`: Último número correlativo emitido
- `tipo_documento`: Tipo de documento (por defecto 'FACTURA')
- `activo`: Si la serie está activa
- `es_por_defecto`: Si es la serie por defecto de la sucursal

**Constraints importantes:**
- Solo puede haber una serie por defecto por sucursal y tipo de documento
- No se pueden repetir series por sucursal y tipo de documento

#### 2. `facturaconfigtenant`
Configuración de diseño de facturas por tenant.

**Campos principales:**
- `id_tenant`: Referencia al tenant
- `logo_url`: URL del logo para el PDF
- `color_primario`: Color primario del diseño
- `cabecera_html`: HTML para la cabecera
- `pie_html`: HTML para el pie de página
- `texto_legal`: Texto legal o condiciones
- `mostrar_columna_iva`: Flag para mostrar columna IVA
- `mostrar_columna_descuento`: Flag para mostrar descuentos
- `mostrar_domicilio_cliente`: Flag para mostrar domicilio
- `mostrar_matricula_vehiculo`: Flag para mostrar matrícula
- `config_json`: Configuración adicional en JSON

#### 3. `facturacabecera`
Cabecera de las facturas emitidas.

**Campos principales:**
- `id_sucursal`, `id_cliente`, `id_orden`: Referencias
- `id_serie`: Serie de facturación utilizada
- `correlativo`: Número secuencial dentro de la serie
- `numero_factura`: Número de factura formateado completo
- `fecha_emision`, `fecha_vencimiento`: Fechas
- `base_imponible`, `importe_iva`, `total`:  Importes
- `estado`: BORRADOR, EMITIDA, ANULADA
- `id_config_tenant`: Configuración utilizada
- `config_snapshot`: Snapshot de la config para mantener diseño
- `pdf_url`: Ruta del PDF generado

**Constraints:**
- Una orden solo puede tener una factura
- Número de factura único por sucursal
- Combinación serie + correlativo debe ser única

#### 4. `facturalinea`
Líneas de detalle de las facturas.

**Campos principales:**
- `id_factura`: Referencia a la cabecera
- `id_producto`: Producto (opcional)
- `descripcion`: Descripción de la línea
- `cantidad`, `precio_unitario`, `porcentaje_descuento`
- `base_imponible`, `importe_iva`, `total_linea`
- `id_impuesto`: Impuesto aplicado
- `posicion`: Orden de la línea

#### 5. `facturapago`
Registro de pagos asociados a facturas.

**Campos principales:**
- `id_factura`: Referencia a la factura
- `id_orden_pago`: Referencia opcional a pago de orden
- `id_medio_pago`: Medio de pago utilizado
- `importe`: Importe del pago
- `fecha_pago`: Fecha del pago
- `referencia_externa`: Referencia de TPV, Bizum, etc.

### Modificaciones en Tablas Existentes

#### `orden`
Se añadieron dos columnas:
- `requiere_factura` (BOOLEAN): Indica si el cliente pidió factura
- `id_factura` (BIGINT): FK a la factura generada

## 🔧 Backend - Servicios y Rutas

### Servicios

#### `facturacionService.js`
Servicio principal con la lógica de negocio.

**Métodos principales:**
- `emitirFacturaDesdeOrden(idOrden, idUsuario, opciones)`: Genera factura desde orden
- `obtenerFacturaCompleta(idFactura)`: Obtiene factura con líneas y pagos
- `listarFacturas(filtros)`: Lista facturas con filtros
- `listarOrdenesPendientesFactura(filtros)`: Lista órdenes pendientes

#### `facturaPDFService.js`
Servicio para generación de PDFs.

**Métodos principales:**
- `generarHTMLFactura(facturaCompleta)`: Genera HTML de la factura
- `generarPDF(idFactura)`: Genera y guarda el PDF
- `obtenerOGenerarPDF(idFactura)`: Obtiene PDF existente o lo genera

### Rutas API

#### Endpoint principal: `/api/facturas`

**Facturas:**
- `POST /api/facturas/ordenes/:id/emitir` - Emitir factura desde orden
- `GET /api/facturas` - Listar facturas (con filtros)
- `GET /api/facturas/:id` - Obtener factura completa
- `GET /api/facturas/:id/pdf` - Generar o devolver PDF
- `POST /api/facturas/:id/regenerar-pdf` - Forzar regeneración de PDF
- `GET /api/facturas/ordenes/pendientes` - Órdenes pendientes de facturar

**Series:**
- `GET /api/facturas/series` - Listar series de facturación
- `POST /api/facturas/series` - Crear nueva serie
- `PUT /api/facturas/series/:id` - Actualizar serie

**Configuración:**
- `GET /api/facturas/config-tenant` - Obtener configuración del tenant
- `PUT /api/facturas/config-tenant` - Actualizar configuración

## 🎨 Frontend - Pantallas

### 1. `manager-taller-facturas.html`
Listado de todas las facturas emitidas.

**Características:**
- Filtros por texto, estado, rango de fechas
- Tabla responsive con información de facturas
- Acciones: Ver detalles, Descargar PDF
- Estados visuales (EMITIDA, BORRADOR, ANULADA)

### 2. `manager-taller-facturas-pendientes.html`
Órdenes pendientes de facturar.

**Características:**
- Estadísticas (total pendientes, importe total, promedio)
- Tabla de órdenes con información del cliente y vehículo
- Botón para generar factura con modal de confirmación
- Campo de observaciones opcional

### 3. `manager-taller-config-facturas.html`
Configuración de facturas por tenant.

**Características:**
- **Tab Diseño:**
  - Logo URL
  - Color primario (picker + hex)
  - Cabecera HTML personalizada
  - Pie de página HTML
  - Texto legal
  - Checkboxes de visualización (IVA, descuento, etc.)

- **Tab Series:**
  - Listado de series de facturación
  - Estado (activa/inactiva)
  - Serie por defecto marcada
  - Opción para crear nueva serie

## 🚀 Instalación y Configuración

### 1. Ejecutar Migración

```bash
cd backend
node ejecutar_migracion_facturacion.js
```

Esto creará todas las tablas necesarias.

### 2. Configurar Serie por Defecto (Opcional)

Para cada sucursal, es recomendable crear una serie por defecto:

```sql
INSERT INTO facturaserie (
  id_sucursal,
  nombre_serie,
  prefijo,
  tipo_documento,
  activo,
  es_por_defecto
) VALUES (
  1,  -- ID de tu sucursal
  'A',
  'F',
  'FACTURA',
  true,
  true
);
```

### 3. Configuración de Tenant (Opcional)

El sistema crea automáticamente una configuración por defecto al acceder por primera vez desde la UI, pero puedes crearla manualmente:

```sql
INSERT INTO facturaconfigtenant (
  id_tenant,
  nombre_plantilla,
  color_primario,
  es_por_defecto
) VALUES (
  1,  -- ID de tu tenant
  'Por defecto',
  '#ff4400',
  true
);
```

## 📝 Flujo de Trabajo

### Generar Factura desde Orden

1. El cliente marca `requiere_factura = true` en la orden
2. La orden debe estar en estado FINALIZADA/CERRADA
3. Desde la UI o API se llama a:
   ```
   POST /api/facturas/ordenes/:id/emitir
   ```
4. El sistema:
   - Valida que la orden sea facturable
   - Obtiene la serie de facturación (por defecto o especificada)
   - **Bloquea la serie** (SELECT FOR UPDATE) para garantizar numeración continua
   - Incrementa el `ultimo_numero` de la serie
   - Genera el `numero_factura`: prefijo + correlativo (8 dígitos) + sufijo
   - Crea la cabecera y líneas de factura
   - Registra los pagos (si existen)
   - Guarda snapshot de configuración
   - Vincula la factura a la orden
   - Todo en **una única transacción** (sin huecos en numeración)

### Generar PDF de Factura

1. Llamar a `GET /api/facturas/:id/pdf`
2. Si no existe PDF, se genera automáticamente usando:
   - Datos de la factura (cabecera, líneas, pagos)
   - Config snapshot (logo, colores, HTML personalizado)
   - Flags de visualización (mostrar IVA, descuento, etc.)
3. El HTML se guarda como `.html` (o se puede usar Puppeteer para PDF real)
4. La URL se guarda en `facturacabecera.pdf_url`

### Personalizar Diseño de Facturas

1. Acceder a `manager-taller-config-facturas.html`
2. En el tab "Diseño":
   - Subir logo (URL)
   - Elegir color primario
   - Añadir HTML personalizado para cabecera y pie
   - Configurar qué campos mostrar
3. Guardar configuración
4. Todas las facturas futuras usarán este diseño
5. Las facturas antiguas mantienen su diseño original (snapshot)

## 🔒 Garantías de Numeración Continua

El sistema garantiza numeración continua mediante:

1. **Transacciones**: Todo el proceso de emitir factura es transaccional
2. **SELECT FOR UPDATE**: Bloquea la fila de la serie durante la transacción
3. **Constraints únicos**: Previenen duplicados a nivel de base de datos
4. **Validaciones**: Múltiples validaciones antes de emitir factura

## ⚠️ Notas Importantes

- **Numeración**: Una vez emitida una factura, el correlativo no se puede reutilizar
- **Series**: Cada sucursal debe tener al menos una serie activa y por defecto
- **Estados**: Solo facturas EMITIDAS se consideran oficiales
- **PDFs**: Se generan bajo demanda y se guardan para reutilización
- **Configuración**: Los cambios de diseño NO afectan facturas antiguas (snapshot)

## 🔮 Futuras Extensiones

El módulo está preparado para:
- Facturas de venta directa (sin orden)
- Abonos y rectificativas
- Numeración por año fiscal
- Múltiples series por sucursal
- Envío de facturas por email
- Integración con sistemas de facturación electrónica

## 📚 Documentación Adicional

Para más información sobre el stack técnico:
- Backend: Node.js + Express + PostgreSQL (Neon)
- Frontend: HTML + TailwindCSS + Vanilla JS
- Base de datos: PostgreSQL con esquema multi-tenant

## 🐛 Solución de Problemas

### No hay serie configurada
**Error**: "No hay serie de facturación configurada para esta sucursal"
**Solución**: Crear una serie por defecto para la sucursal (ver sección 2)

### La orden ya tiene factura
**Error**: "Esta orden ya tiene una factura generada"
**Solución**: Cada orden solo puede tener una factura. No se permite facturar dos veces la misma orden.

### PDF no se genera
**Problema**: El PDF no se muestra
**Solución**: Verificar que el directorio `backend/uploads/facturas` existe y tiene permisos de escritura.

## 📧 Soporte

Para cualquier duda o problema, contacta al equipo de desarrollo.

---

**Versión**: 1.0.0  
**Fecha**: Diciembre 2025  
**Autor**: Equipo Versa
