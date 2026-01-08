# Testing Documentation - Versa-App Backend

## Overview

Este documento describe el sistema de testing implementado para Versa-App Backend utilizando Jest.

## Estructura de Carpetas

```
backend/
├── tests/
│   ├── setup.js                    # Configuración global de Jest (mocks de BD)
│   ├── fixtures/                   # Datos de prueba reutilizables
│   │   ├── ordenes.fixture.js      # Datos para tests de órdenes
│   │   ├── pagos.fixture.js        # Datos para tests de pagos y caja
│   │   └── productos.fixture.js    # Datos para tests de inventario
│   ├── unit/                       # Tests unitarios
│   │   ├── services/
│   │   │   ├── ordenPagoService.test.js   # 23 tests
│   │   │   ├── ordenesService.test.js     # 18 tests
│   │   │   └── ventasService.test.js      # 11 tests
│   │   └── repositories/
│   │       └── ordenPagoRepository.test.js # 17 tests
│   └── integration/                # Tests de integración
│       ├── caja.test.js            # 20 tests
│       ├── inventory.test.js       # 12 tests
│       └── compras.test.js         # 11 tests
├── jest.config.js                  # Configuración de Jest
└── package.json                    # Scripts de testing
```

## Comandos de Testing

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (desarrollo)
npm run test:watch

# Ejecutar solo tests críticos (pagos, caja, órdenes, ventas)
npm run test:critical

# Ejecutar solo tests unitarios
npm run test:unit

# Ejecutar solo tests de integración
npm run test:integration

# Ejecutar con reporte de cobertura
npm run test:coverage
```

## Áreas Críticas Cubiertas

### 1. Pagos (Riesgo ALTO) - 40 tests
- Validación de inputs (ID orden, importe, medio de pago)
- Verificación de existencia de entidades
- Auto-detección y creación de caja
- Manejo de transacciones con rollback
- Persistencia correcta de pagos

### 2. Caja (Riesgo ALTO) - 20 tests
- Cálculo de efectivo esperado
- Movimientos de ingreso y egreso
- Cierre de caja con arqueo
- Cálculo de diferencias
- Formato de moneda

### 3. Órdenes (Riesgo ALTO) - 18 tests
- Cálculo de totales con IVA
- Aplicación de descuentos por línea
- Descuento de stock por productos
- Actualización con ajuste diferencial de stock
- Estados de pago (pagado, parcial, pendiente)

### 4. Ventas (Riesgo ALTO) - 11 tests
- Cálculo de totales con IVA y descuentos
- Descuento de stock
- Registro de pagos
- Anulación con devolución de stock

### 5. Inventario (Riesgo MEDIO) - 12 tests
- Aislamiento multi-tenant
- Validación de códigos únicos
- Movimientos de inventario
- Alertas de stock bajo
- Valoración de inventario

### 6. Compras (Riesgo MEDIO) - 11 tests
- Entrada de inventario desde compra
- Cálculo de IVA en compras
- Asociación con proveedor
- Actualización de costos promedio

## Fixtures (Datos de Prueba)

### ordenes.fixture.js
- `ordenes`: Órdenes en diferentes estados (completa, pagada, parcial)
- `lineasOrden`: Líneas de producto y servicio con cálculos
- `crearOrdenData`: Datos para crear órdenes nuevas

### pagos.fixture.js
- `mediosPago`: Efectivo, tarjeta, transferencia, cuenta corriente
- `pagos`: Pagos en diferentes estados
- `registrarPagoData`: Casos válidos e inválidos para testing
- `cajas`: Cajas abiertas y cerradas

### productos.fixture.js
- `productos`: Productos con diferentes niveles de stock
- `movimientosInventario`: Entradas, salidas, ajustes
- `categorias`: Categorías de productos

## Mocking Strategy

### Base de Datos
Los tests utilizan mocks de la conexión a la base de datos para evitar:
- Conexiones reales durante tests
- Modificación de datos de desarrollo/producción
- Dependencias externas que hacen los tests lentos

```javascript
// setup.js - Mock global de la BD
jest.mock('../db', () => ({
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue(mockClient)
}));
```

### Utilidades de Testing
El archivo `setup.js` proporciona utilidades globales:
- `testUtils.createMockClient()`: Cliente de BD para transacciones
- `testUtils.createMockRequest()`: Objeto request de Express
- `testUtils.createMockResponse()`: Objeto response de Express

## Buenas Prácticas Implementadas

1. **Arrange-Act-Assert (AAA)**: Cada test sigue el patrón AAA
2. **Nombres descriptivos**: Los tests siguen el formato `metodo_condicion_resultado`
3. **Aislamiento**: Cada test es independiente (beforeEach limpia mocks)
4. **Precision numérica**: Uso de `toBeCloseTo` para comparaciones decimales
5. **Cobertura de edge cases**: Tests para valores null, undefined, vacíos, negativos

## Ejecución Pre-Push

Antes de hacer push a GitHub, ejecutar:

```bash
npm run test:critical
```

Esto ejecutará los tests de las áreas críticas (pagos, caja, órdenes, ventas) para asegurar que no hay regresiones en funcionalidad financiera.

## Próximos Pasos (Opcionales)

1. **Tests E2E**: Implementar tests end-to-end con base de datos de testing
2. **GitHub Actions**: Configurar CI/CD para ejecutar tests automáticamente
3. **Pre-commit hooks**: Usar Husky para ejecutar tests antes de commits
