# Documentación: Módulo SaaS Contabilidad (FinSaaS)

Esta sección documenta el estado actual, la arquitectura y las funcionalidades del vertical de Contabilidad (FinSaaS) dentro de la plataforma Versa.

## 1. Arquitectura del Frontend

El módulo utiliza una arquitectura de **App Shell** dinámica para desacoplar el contenido de la página de la estructura de navegación.

### App Shell (`FinSaaSLayout.js`)
Todas las páginas cargan un componente central de layout que inyecta:
- **Sidebar Dinámico**: Navegación lateral consistente definida en `finsaas.nav.js`.
- **Header Reactivo**: Barra superior con navegación móvil, notificaciones y títulos dinámicos.
- **Gestión de Sesión**: Muestra el nombre y rol del usuario logueado.
- **Modo Oscuro Nativo**: Estética premium basada en el diseño de "Holded".

## 2. Estructura de Archivos

Los archivos se organizan bajo el vertical de FinSaaS para mantener la separación del código del "Manager" tradicional:

```text
frontend/
├── src/verticals/finsaas/
│   ├── layout/
│   │   ├── FinSaaSLayout.js   (Lógica del Shell)
│   │   └── FinSaaSLayout.css  (Estilos del Shell)
│   ├── nav/
│   │   └── finsaas.nav.js     (Configuración de enlaces)
│   └── pages/
│       ├── dashboard.html     (KPIs y Resumen Financiero)
│       ├── facturas.html      (Gestión de Ventas)
│       ├── caja.html          (Control de Tesorería Diaria)
│       ├── contactos.html     (Clientes y Proveedores Fiscales)
│       ├── empresas.html      (Configuración de Empresas Contables)
│       └── trimestres.html    (Cierres de IVA)
```

## 3. Páginas Implementadas

### Dashboard Principal
- Visualización de KPIs financieros (Ingresos, Gastos, Resultado, IVA).
- Gráfico de evolución (en desarrollo).
- Lista de actividad reciente unificada.

### Gestión de Facturas (Ventas)
- Listado con filtros por estado.
- Drawer/Modal para creación de facturas con selección de empresa.
- Soporte para adjuntos y estados de pago.

### Contactos Fiscales
- Gestión unificada de Clientes y Proveedores.
- Soporte para tipo `AMBOS`.
- Campos extendidos: IBAN, Condiciones de Pago, NIF/CIF validado.

### Tesorería (Caja)
- Registro de movimientos de entrada y salida.
- Cálculo de saldo actual por sucursal/empresa.
- Historial de transacciones de hoy.

### Fiscalidad (IVA)
- Resumen anual de IVA repercutido y soportado.
- Gestión de cierres trimestrales (Q1-Q4).
- Sistema de bloqueo de periodos cerrados.

## 4. Autenticación y Redireccionamiento

- **EntryPoint**: `login-finsaas.html` específico con estética coordinada.
- **Auth Guard**: Todas las páginas requieren sesión válida vía `requireAuth()`.
- **Context Awareness**: El sistema detecta si el usuario está en `/finsaas/` y redirige automáticamente al login correspondiente si la sesión expira.

## 5. Integración con el Backend

El frontend se comunica con el módulo backend `contable` a través de rutas protegidas:
- `x-empresa-id`: Todas las peticiones incluyen este header para filtrar datos por la empresa contable seleccionada.
- **Proxy**: Utiliza el proxy de Vite para redirigir peticiones `/api/*` al servidor local de desarrollo (puerto 3000).

## 6. Configuración de Vite

Los puntos de entrada están registrados en `vite.config.js` bajo el objeto `rollupOptions.input`, lo que permite que Vite procese y optimice cada página HTML individualmente.
