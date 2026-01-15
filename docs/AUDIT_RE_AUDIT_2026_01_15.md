# INFORME DE RE-AUDITORÍA TÉCNICA: PROYECTO VERSA
**Fecha:** 15 de enero de 2026  
**Auditor:** Senior Staff Software Architect & Technical Auditor  
**Estado:** Re-Audit (V2 Modular implementation)

---

## 1) EXECUTIVE SUMMARY

| Pilar | Score | Estado | Observación Principal |
| :--- | :---: | :---: | :--- |
| 1. Arquitectura & Modularidad | 6/10 | ⚠️ | Migración V2 en curso; alta coexistencia con legacy. |
| 2. Multi-tenancy & Aislamiento | 5/10 | 🚨 | RLS diseñado pero bypass en repositorios V2. |
| 3. Seguridad & RBAC | 4/10 | 🚨 | Drift de permisos entre registro central y base de datos. |
| 4. Data Model & Migraciones | 6/10 | ⚠️ | Knex subutilizado; exceso de scripts manuales y duplicados. |
| 5. API Design & Contratos | 7/10 | ✅ | REST consistente, aunque dependiente de headers custom. |
| 6. Testing Strategy | 5/10 | ⚠️ | Tests de integración existentes pero CI incompleto. |
| 7. CI/CD & Releases | 4/10 | 🚨 | CI sin base de datos real; riesgos en validación de deploys. |
| 8. Observabilidad | 6/10 | ✅ | Logger estructurado sólido; falta integridad en Audit Logs. |
| 9. Developer Experience (DX) | 3/10 | 🚨 | Caos en estructura de archivos y duplicidad crítica. |
| 10. Deuda Técnica & Roadmap | 4/10 | 🚨 | Refactorización V2 incompleta y raw SQL masivo. |

### **PROMEDIO TOTAL: 5.0 / 10**

### **VERDICTO: NO LISTO PARA ESCALAR (20+ USUARIOS)**
**Razones:**
1.  **Riesgo de Fuga de Datos**: Aunque existe un plan de RLS (Row Level Security), los nuevos repositorios V2 (ej. Contable) usan el pool de conexión directo, haciendo bypass a las capas de seguridad diseñadas (`tenant-db.js`).
2.  **Inconsistencia de Seguridad (RBAC)**: Los permisos definidos en el código no coinciden con los usados en las rutas del módulo FinSaaS, lo que imposibilita una auditoría de accesos fiable.
3.  **Inestabilidad de Mantenimiento**: La coexistencia masiva de archivos duplicados (`folder 2`, `file 2`) y lógica mezclada entre Legacy y V2 elevará exponencialmente los costos de desarrollo y la probabilidad de regresiones.

---

### **TOP 10 RIESGOS (Priorizados)**
1.  **[CRÍTICO] Bypass de RLS**: Uso de `pool.query` en lugar de `getTenantDb` en repositorios V2.
2.  **[CRÍTICO] Drift de Permisos**: Permisos `contabilidad.*` no registrados en `permissions.js`.
3.  **[ALTO] Duplicidad de Archivos**: Carpetas y archivos clones (`infra 2`, `api 2`) en el sistema de archivos sincronizado.
4.  **[ALTO] CI/CD Ciego**: Las pruebas automatizadas en GitHub Actions no tienen acceso a una base de datos real, validando solo sintaxis.
5.  **[ALTO] Raw SQL Masivo**: Falta de abstracción en queries aumenta riesgo de inyección y errores de mantenimiento.
6.  **[MEDIO] Mix Legacy/V2**: Clientes y Vehículos operan en dos estructuras simultáneas.
7.  **[MEDIO] Frontend Flat**: Más de 80 archivos en el root de `/frontend` sin estructura de componentes.
8.  **[MEDIO] Headers Custom Volátiles**: Dependencia de `x-empresa-id` para lógica de multi-empresa sin validación estricta en middleware.
9.  **[BAJO] Inconsistencia Naming DB**: Mezcla de `contabilidad_*` y `contable_*` en tablas nuevas.
10. **[BAJO] Secrets Exposure Check**: Aunque `.env` está en `.gitignore`, la proliferación de archivos clonados aumenta riesgo de leak accidental.

---

## 2) DEEP DIVE POR PILAR

### 1. Arquitectura & Modularidad (6/10)
- **[PROBLEMA]** Coexistencia de patrones. El sistema tiene rutas en `backend/routes/` y en `backend/src/modules/` para las mismas entidades.
- **[EVIDENCIA]** `/backend/routes/clientes.js` vs `/backend/src/modules/clientes/`.
- **[IMPACTO]** Confusión en el punto de entrada de la lógica de negocio; dificultad para aplicar patches globales.
- **[SEVERIDAD]** ALTO.
- **[RECOMENDACIÓN]** Cut-over definitivo a V2 y movimiento de archivos a `legacy/` tras verificación de paridad de features.

### 2. Multi-tenancy & Aislamiento (5/10)
- **[PROBLEMA]** Desconexión entre arquitectura y ejecución. Se diseñó `tenant-db.js` para forzar RLS, pero no se usa en los nuevos repositorios.
- **[EVIDENCIA]** `/backend/src/modules/contable/infra/repos/contabilidad.repo.js:7` (importa el pool directo).
- **[IMPACTO]** Las políticas de RLS en la base de datos no se activan porque la sesión de DB no conoce el `tenantId`. Aislamiento depende únicamente de que el dev no olvide el `WHERE id_tenant = $1`.
- **[SEVERIDAD]** CRÍTICO.
- **[RECOMENDACIÓN]** Refactorizar todos los repositorios V2 para usar `getTenantDb(ctx)`.

### 3. Seguridad & RBAC (4/10)
- **[PROBLEMA]** Fuente de verdad fragmentada. El archivo central de permisos está desactualizado respecto a la base de datos y las rutas.
- **[EVIDENCIA]** `/backend/src/core/security/permissions.js` no contiene permisos de `contabilidad.*` usados en `/backend/src/modules/contable/api/contabilidad.routes.js`.
- **[IMPACTO]** Imposibilidad de gestionar roles desde UI de forma coherente.
- **[SEVERIDAD]** ALTO.
- **[RECOMENDACIÓN]** Sincronizar el registry de permisos antes de habilitar FinSaaS a usuarios finales.

### 9. Developer Experience (DX) (3/10)
- **[PROBLEMA]** Entorno de archivos corrupto/sucio. Presencia masiva de duplicados originados probablemente por problemas de sincronización (iCloud/macOS).
- **[EVIDENCIA]** `/backend/src/modules/contable/infra 2`, `/frontend/impuestos-service 2.js`.
- **[IMPACTO]** Error humano extremo al editar el archivo incorrecto.
- **[SEVERIDAD]** ALTO.
- **[RECOMENDACIÓN]** Cleanup masivo de archivos finalizados en ` 2.js` y ` 2.sql`.

---

## 3) CLEANUP STATUS

| Item | Estado | Acción Sugerida |
| :--- | :--- | :--- |
| `backend/routes/clientes.js` | Legacy | **BORRAR** tras confirmar que V2 absorbió toda la lógica. |
| `backend/routes/vehiculos.js` | Legacy | **BORRAR** tras confirmar paridad V2. |
| Files ending in ` 2.js` / ` 2.sql` | Corrupción/Duplicado | **BORRAR INMEDIATAMENTE** (revisar diff primero). |
| Scripts en root de `backend/` | Deuda Técnica | Mover a `backend/scripts/migrations/` o integrarlos en Knex. |
| `/legacy/routes` | Histórico | Mantener comprimido o fuera del repo activo. |

---

## 4) ROADMAP PARA SUBIR A 9/10

### Fase 0 (48–72h): Seguridad & Aislamiento
1.  **Fix RLS Integration**: Cambiar `pool.query` por `getTenantDb(ctx).query` en todos los repositorios V2.
2.  **Permission Sync**: Actualizar `permissions.js` y `roles.js` con todos los scopes de FinSaaS.
3.  **File System Sanitization**: Eliminar todos los duplicados " 2" en todo el repositorio.

### Fase 1 (1-2 semanas): Consolidación V2
1.  **Depuración de Rutas**: Eliminar archivos de `backend/routes/` que ya tengan versión en `src/modules/`.
2.  **CI/CD con DB**: Configurar un servicio de Postgres en GitHub Actions y ejecutar migraciones reales antes de los tests.

### Fase 2 (2-6 semanas): Estandarización
1.  **Refactorización SQL**: Introducir Knex Query Builder en repositorios para eliminar SQL crudo y mejorar legibilidad.
2.  **Frontend Modularización**: Mover archivos de `/frontend` a una estructura de carpetas por vertical (`/frontend/manager`, `/frontend/finsaas`).

---

## 5) EVIDENCIA FALTANTE (Gaps de Auditoría)
1.  **Listado de Tablas con RLS Activo**: Resultado de `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE relrowsecurity = true;` en producción/staging.
2.  **Logs de Make (OCR)**: Necesito ver la estructura de respuesta del webhook de vuelta hacia `/api/contabilidad/egresos/callback`.
3.  **Configuración de Secrets en Cloud**: ¿Cómo se gestionan las env vars en el entorno de despliegue real?
4.  **Audit Logs Data**: Muestra de 5 filas de la tabla `audit_logs` (o `audit_log`) para verificar consistencia con `request_id`.
5.  **Plan de Rollback**: Documento de cómo se revierte un despliegue en caso de fallo en migraciones críticas.
