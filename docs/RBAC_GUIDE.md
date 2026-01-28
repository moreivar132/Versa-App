# Guía de Gestión de Permisos y Vistas (FinSaaS)

Esta guía explica cómo gestionar quién puede ver qué en la vertical de FinSaaS sin depender de cambios de código complejos ("hardcoding").

## Arquitectura del Sistema

El sistema se basa en tres niveles:
1.  **Permisos (Permissions):** Acciones atómicas (ej: `contabilidad.factura.read`).
2.  **Roles:** Grupos de permisos (ej: `ACCOUNTING`, `TENANT_ADMIN`).
3.  **Vistas (Frontend):** Elementos del menú lateral que aparecen o desaparecen según si el usuario tiene el permiso requerido.

---

## Cómo modificar la visibilidad de un Rol

Si quieres que un Rol (por ejemplo, `Contable`) vea una nueva sección o deje de verla, debes editar el archivo:
`backend/src/core/rbac/definitions.js`

### 1. Localiza el Rol en la lista `ROLES`
```javascript
{
    nombre: 'ACCOUNTING',
    display_name: 'Contable',
    permissions: [
        'contabilidad.read',
        'contabilidad.factura.read',
        // Añade o quita permisos aquí
    ]
}
```

### 2. Sincroniza los cambios con la Base de Datos
Una vez editado el archivo, ejecuta:
```bash
npm run db:sync-rbac
```
*(Se puede automatizar para que ocurra en cada despliegue).*

---

## Cómo añadir una nueva sección al Menú

Si creas una página nueva y quieres que se controle por permisos:

### 1. Define el nuevo permiso
En `definitions.js`, añade el permiso a la lista `PERMISSIONS`:
```javascript
{ key: 'contabilidad.mipagina.read', nombre: 'Ver Mi Nueva Página', module: 'contabilidad', vertical_id: VERTICALS.SAAS }
```

### 2. Asígnalo al Rol correspondiente
Añade `contabilidad.mipagina.read` al array de `permissions` del rol que deba verla.

### 3. Configura el Menú Frontend
En `frontend/src/verticals/finsaas/nav/finsaas.nav.js`, añade la ruta y asóciala al permiso:
```javascript
{
    id: 'mi-pagina',
    label: 'Mi Nueva Página',
    route: '/src/verticals/finsaas/pages/mi-pagina.html',
    icon: 'star',
    requiredPermission: 'contabilidad.mipagina.read'
}
```

---

## Mapeo actual de FinSaaS (Granular)

| Sección en Menú | Permiso Requerido |
| :--- | :--- |
| **Dashboard** | `contabilidad.dashboard.read` |
| **Facturas** | `contabilidad.factura.read` |
| **Biblioteca** | `contabilidad.documento.read` |
| **Subir Gasto (IA)** | `contabilidad.gasto.write` |
| **Caja / Bancos** | `contabilidad.tesoreria.read` |
| **Empresas** | `contabilidad.empresa.read` |
| **Trimestres** | `contabilidad.trimestre.read` |
| **Validación Deducible** | `contabilidad.deducible.approve` |
| **Usuarios / Roles** | `finsaas.invites.manage` / `finsaas.rbac.manage` |
| **Config. Factura** | `contabilidad.config.read` |

---

## Notas de Seguridad
*   **Super Admin:** Los usuarios marcados como `is_super_admin` en la base de datos saltan todas estas comprobaciones y ven **TODO**.
*   **Sincronización:** Si borras un permiso de `definitions.js` y ejecutas el sync con `--cleanup`, se borrará de la DB y de todos los roles automáticamente.
