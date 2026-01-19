# Sistema RBAC - FinSaaS

Este documento describe el sistema de Control de Acceso Basado en Roles (RBAC) implementado para FinSaaS, diseñado para restringir el acceso a funcionalidades sensibles a nivel de Tenant.

## Roles y Niveles de Acceso

El sistema distingue entre roles de sistema y permisos granulares.

### Roles Principales

1.  **SUPER_ADMIN**: Acceso total a todo el sistema y todos los tenants.
2.  **ADMIN / TENANT_ADMIN**: Administrador de la organización (Tenant). Tiene control total sobre su instancia de FinSaaS.
3.  **USER / ACCOUNTANT / VIEWER**: Usuarios estándar con acceso limitado a funcionalidades operativas, pero sin acceso a configuración, gestión de usuarios o validación fiscal crítica.

## Permisos Clave

Los siguientes permisos controlan el acceso a las áreas restringidas:

| Permiso | Descripción | Rol Típico |
| :--- | :--- | :--- |
| `finsaas.deducible.manage` | Permite validar/rechazar facturas como deducibles. | TENANT_ADMIN |
| `finsaas.invites.manage` | Permite crear, listar y eliminar invitaciones de usuarios. | TENANT_ADMIN |
| `finsaas.rbac.manage` | Permite gestionar usuarios, roles y accesos a empresas. | TENANT_ADMIN |
| `finsaas.empresa.manage` | Permite crear y eliminar empresas. | TENANT_ADMIN |
| `contabilidad.read` | Acceso de lectura a documentos y facturas. | USER / ACCOUNTANT |
| `contabilidad.write` | Crear y editar facturas/gastos. | USER / ACCOUNTANT |

## Protecciones Implementadas

### 1. Backend (API Security)
Todos los endpoints sensibles están protegidos por el middleware `requirePermission`. Si un usuario sin el permiso requerido intenta acceder, recibirá un error **403 Forbidden**.

-   **Invitaciones**: `/api/saas/invites` (POST/GET/DELETE) → Requiere `finsaas.invites.manage`.
-   **RBAC Panel**: `/api/finsaas/admin/rbac/*` → Requiere `finsaas.rbac.manage`.
-   **Empresas**: `/api/contabilidad/empresas` (POST/DELETE) → Requiere `finsaas.empresa.manage`.
-   **Deducibilidad**: `/api/contabilidad/facturas/:id/deducible` (PATCH) → Requiere `finsaas.deducible.manage` (o `contabilidad.deducible.approve`).

### 2. Frontend (Sidebar & Routing)
-   **Sidebar**: Los menús "Validación Deducible", "Usuarios e Invitaciones" y "Permisos y Roles" están ocultos para usuarios que no tengan los permisos necesarios.
-   **Route Guards**: Si un usuario intenta acceder directamente por URL (ej: `/src/verticals/finsaas/pages/permisos.html`), se mostrará una pantalla de "Acceso Restringido".

## Guía de Gestión (Para Admins)

### Invitar Usuarios
Desde la sección **Usuarios e Invitaciones**, solo los administradores pueden generar enlaces de invitación. Pueden especificar:
-   **Rol**: Administrador, Contable o Solo Lectura.
-   **Empresa**: Asignación automática a una empresa (opcional).
-   **Caducidad**: Tiempo de validez del enlace.

### Gestionar Permisos
Desde la sección **Permisos y Roles**, un administrador puede:
-   Ver todos los usuarios activos del tenant.
-   Cambiar el rol de un usuario (ej: promover a Admin).
-   Asignar o revocar acceso a empresas específicas dentro del tenant.

> **Nota**: Un administrador no puede quitarse su propio rol de administrador para prevenir bloqueos accidentales.
