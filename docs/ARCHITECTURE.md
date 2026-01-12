# Versa V2: Arquitectura Objetivo

## Principios
- **Modular Monolith**: El sistema se organiza en módulos autónomos dentro de un mismo despliegue. Cada módulo es el dueño de su lógica y sus datos.
- **Clean Boundaries**: La comunicación entre módulos debe ser explícita (vía servicios internos o eventos), nunca mediante acceso directo a tablas ajenas.
- **Single Responsibility**: Cada componente (controller, service, repository) tiene una única razón para cambiar.
- **Don't Repeat Yourself (DRY) vs Decoupling**: Preferimos duplicar ligeramente lógica menor si eso evita un acoplamiento fuerte entre módulos críticos.

## Flujo de Request
Cada petición entrante sigue un camino predecible:

1.  **Middleware**: Autenticación, validación de permisos (RBAC) y extracción del `id_tenant`.
2.  **Controller**: Valida el input de la request y delega la lógica de negocio al Service. No contiene lógica de negocio compleja ni SQL.
3.  **Service**: Orquesta la lógica de negocio. Es el único lugar donde se aplican reglas de dominio. Puede llamar a múltiples repositorios del mismo módulo o a servicios de otros módulos.
4.  **Repository**: Encapsula el acceso a datos. Contiene las consultas SQL (preferiblemente vía Knex/Query Builder). No contiene lógica de negocio.

## Enfoque Multi-tenant
Versa V2 utiliza una estrategia de **Aislamiento en Nivel de Datos**:

-   **Opción A (Wrapper/Middleware)**: Todas las consultas inyectan automáticamente el `id_tenant` en la cláusula `WHERE`. Esto se gestiona en la capa de `Repository`.
-   **Opción B (RLS - Row Level Security)**: Uso de políticas de PostgreSQL para asegurar que un usuario solo acceda a filas con su `id_tenant`.
-   **Middleware de Contexto**: Se utiliza un `AsyncLocalStorage` (o similar) para persistir el `id_tenant` durante todo el ciclo de vida de la request sin tener que pasarlo manualmente por todos los métodos.

## Implementación Física (Esqueleto V2)
La infraestructura base reside en `src/core` y provee servicios transversales a todos los módulos.

### Directorios Core
- `src/core/http/middlewares/`: Guardianes de las peticiones.
    - `tenant-context.ts`: Gestiona el aislamiento mediante `AsyncLocalStorage`.
    - `auth.ts`: Maneja la identidad del usuario.
    - `rbac.ts`: Control de acceso granular.
    - `error-handler.ts`: Normalización de respuestas de error.
- `src/core/db/`: Abstracción de datos con enforcing de `tenantId`.
- `src/core/logging/`: Logger trazable con `requestId`.

### Aislamiento de Datos (Multi-tenancy)
Se utiliza un patrón de "inyección de contexto":
1. El middleware extrae el `id_tenant`.
2. El repositorio utiliza `withTenant(query)` para asegurar que ninguna query escape al aislamiento.

## Estrategia de Migración Incremental
... (resto del contenido)
