# Quality Gates (Estándares de Calidad)

Este documento define los requisitos mínimos que debe cumplir cualquier código antes de ser integrado en la rama principal.

## 1. Pipeline de Integración Continua (CI)

Cualquier Pull Request disparará automáticamente el pipeline de CI. Para que un PR pueda ser aprobado, los siguientes pasos deben pasar sin errores:

### A. Linting
- Se ejecuta `npm run lint`.
- No se permiten errores de ESLint. Las advertencias (`warn`) deben ser revisadas pero no bloquean el merge por defecto.
- **Regla**: Formatear el código antes de subirlo.

### B. Pruebas Automáticas (Tests)
- Se ejecuta `npm test`.
- Todos los tests existentes deben pasar.
- **REGLA DE ORO**: Cada módulo nuevo o migrado DEBE incluir al menos 3 tests críticos:
    1. **Caso OK**: 200/201 con autenticación y tenant válidos.
    2. **Sin Tenant**: 403 (TENANT_REQUIRED) si falta el contexto.
    3. **Sin Permisos**: 403 si el usuario no tiene el permiso RBAC necesario.

### C. Build
- Se ejecuta `npm run build:frontend`.
- El build de Vite no debe fallar.

---

## 2. Estándares de Código

Referencia: [GUARDRAILS.md](../docs/GUARDRAILS.md)

1. **Multi-tenancy**: Prohibido usar queries SQL que no incluyan el filtro de `id_tenant` (usar siempre el wrapper `getTenantDb`).
2. **Arquitectura**: Los nuevos módulos deben seguir la estructura:
   - `api/`: Rutas y Controllers.
   - `application/`: Lógica de negocio (Services).
   - `infra/`: Persistencia (Repositories).
3. **No SQL en Rutas**: Las rutas deben delegar a controllers, y los controllers a services.
4. **Documentación**: Todo endpoint nuevo debe estar documentado en Swagger (JSDoc en las rutas).

---

## 3. Proceso de Pull Request (PR)

### Requisitos del PR:
1. **Descripción**: Explicar CLARAMENTE qué se cambió y POR QUÉ.
2. **Checklist**: Marcar que se han corrido los tests localmente.
3. **Evidencia**: Adjuntar capturas de pantalla o logs si hay cambios visuales o de API.

### Commits:
Se recomienda seguir [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: ...` para nuevas funcionalidades.
- `fix: ...` para corrección de errores.
- `docs: ...` para cambios en documentación.
- `refactor: ...` para cambios de código que no añaden funcionalidad ni arreglan bugs.

---

## 4. Bloqueo de Merges

Los administradores del repositorio tienen configurado:
- **Require status checks to pass**: `quality-check` debe ser verde.
- **Require linear history**: Se prefiere rebase o squash merge para mantener el historial limpio.
