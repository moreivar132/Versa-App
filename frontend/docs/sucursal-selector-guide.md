# Guía de Integración: Selector de Sucursal

## Descripción
Componente reutilizable para mostrar y cambiar la sucursal actual en todas las páginas del panel de gestión.

## Archivos del componente
- `frontend/services/sucursal-selector.js` - Lógica del componente
- `frontend/styles/sucursal-selector.css` - Estilos CSS

## Cómo integrar en una página

### Paso 1: Agregar el contenedor HTML
En el header de la página, agregar un div con el ID para el selector:

```html
<header class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#282e39] pb-6">
    <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">Título de la Página</h1>
        <p class="text-[#9da6b9] text-sm mt-1">Descripción</p>
    </div>
    <!-- Contenedor para el selector de sucursal -->
    <div id="sucursal-selector-container"></div>
</header>
```

### Paso 2: Importar e inicializar en el script module
En el bloque `<script type="module">`:

```javascript
import { initSucursalSelector, getCurrentSucursalId, onSucursalChange } from './services/sucursal-selector.js';

(async () => {
    // ... código de autenticación ...

    // Inicializar el selector de sucursal
    const sucursalId = await initSucursalSelector('sucursal-selector-container', {
        onchange: (nuevaSucursalId) => {
            // Recargar los datos de la página con la nueva sucursal
            cargarDatos();
        }
    });

    // Cargar datos iniciales
    cargarDatos();

    async function cargarDatos() {
        const sucursalActual = getCurrentSucursalId();
        // Usar sucursalActual en las llamadas API
        const response = await fetch(`/api/datos?sucursal=${sucursalActual}`);
        // ...
    }
})();
```

### Paso 3: (Opcional) Escuchar cambios de sucursal globalmente
Si necesitas reaccionar a cambios de sucursal desde cualquier parte del código:

```javascript
import { onSucursalChange } from './services/sucursal-selector.js';

onSucursalChange((nuevaSucursalId) => {
    console.log('La sucursal cambió a:', nuevaSucursalId);
    // Actualizar datos...
});
```

## API del Componente

### `initSucursalSelector(containerId, options)`
Inicializa el selector en el contenedor especificado.

**Parámetros:**
- `containerId` (string): ID del elemento contenedor
- `options` (object): Opciones de configuración
  - `onchange` (function): Callback cuando cambia la sucursal

**Retorna:** Promise<number|null> - ID de la sucursal actual

### `getCurrentSucursalId()`
Obtiene el ID de la sucursal actual.

**Retorna:** number|null

### `getCurrentSucursal()`
Obtiene el objeto completo de la sucursal actual.

**Retorna:** object|null - `{ id, nombre, tenant_nombre, ... }`

### `getSucursales()`
Obtiene todas las sucursales disponibles.

**Retorna:** array

### `onSucursalChange(callback)`
Suscribe una función al evento de cambio de sucursal.

### `setSucursal(sucursalId)`
Cambia la sucursal actual programáticamente.

### `SUCURSAL_STORAGE_KEY`
Constante exportada: `'versa_selected_sucursal'`

## Páginas pendientes de integrar
- [ ] manager-taller-clientes.html
- [ ] manager-taller-proveedores.html
- [ ] manager-taller-facturas.html
- [ ] manager-taller-facturas-pendientes.html
- [ ] manager-taller-config-facturas.html
- [ ] manager-taller-compras-historial.html
- [ ] manager-taller-ordenes.html
- [ ] manager-taller-chat.html
- [ ] manager-taller-whatsapp.html
- [ ] manager-taller-inventario-nuevo.html
