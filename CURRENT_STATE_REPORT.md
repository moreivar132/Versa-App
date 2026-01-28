# DIAGNÓSTICO DE ESTADO ACTUAL (POST-FIX) — VERSA

**Fecha:** 28/01/2026
**Objetivo:** Fotografía estática del sistema tras fixes de CORS/Login.

---

## 2) Estado de Infraestructura y Entornos

| Área | Estado | Evidencia | Comentarios |
|---|---|---|---|
| Backend Prod operativo | ✅ OK | `/api/health` en `backend/index.js` (L210) | Responde JSON con `X-Build-Id`. |
| Frontend Prod operativo | ✅ OK | URL Netlify | Asumido por prompt. |
| Login FinSaaS Prod | ✅ OK | `backend/routes/auth.js` | Flujos de Auth y GoogleAuth activos. |
| Aislamiento de entornos | ✅ OK | `backend/index.js` (L7-17) | Safeguards activos: Bloquea arranque en Prod si faltan vars críticas. |
| Variables críticas en Prod | ✅ OK | `index.js` & `knexfile.js` | `NODE_ENV`, `DATABASE_URL` validadas al inicio. |

---

## 3) Estado Funcional por Vertical

### 3.1 FinSaaS (Módulo Principal)
Arquitectura: Modular V2 (`backend/src/modules`).
| Funcionalidad | Estado | Evidencia | Riesgo |
|---|---|---|---|
| Login | ✅ OK | Routes activas | Bajo |
| Dashboard | ⚠️ Parcial | `routes/dashboardPrefs.js` | Lógica legacy mezclada. |
| Facturas | ⚠️ Legacy | `routes/facturas.js` | No migrado 100% a módulo V2. |
| Documentos | ⚠️ Legacy | `routes/upload.js` | Dependencia de FS local (ver Storage). |
| Banking / Imports | ✅ V2 | `modules/banking` | Módulo moderno independiente. |
| Income Events | ⚠️ Legacy | `routes/incomeEvents.js` | Ruta legacy estándar. |

### 3.2 Manager / Taller
Arquitectura: Legacy (`backend/routes/*`).
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Login | ✅ OK | Compartido con Auth |
| Órdenes | ⚠️ Legacy | `routes/ordenes.js` |
| Clientes | 🔄 Mixto | `src/modules/clientes` vs `routes/crm_chat` | Superposición de lógica. |

### 3.3 Marketplace
Arquitectura: Legacy (`backend/routes/marketplace.js`).
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Público | ⚠️ Legacy | `routes/marketplace.js` | Monolítico en archivo de rutas. |
| Admin | ⚠️ Legacy | `routes/marketplaceAdmin.js` | Monolítico en archivo de rutas. |

---

## 4) Estado de Base de Datos y Migraciones

1. **Sincronización:**
   - Carpeta `backend/migrations` contiene scripts recientes (`seed_verticals.js`, `seed_rbac_permissions.js`).
   - El sistema NO usa estructura limpia de migraciones numeradas tradicionales solamente, confía mucho en scripts `run_*.js` en raíz para parches.

2. **Riesgos:**
   - **Alto:** Gran cantidad de tablas creadas via seeds o scripts ad-hoc (`seed_billing_plans.js`).
   - **Riesgo de "Relation does not exist":** Moderado. El orden de ejecución depende de la fecha, pero hay muchos archivos "fix" recientes (`migration_fix_4_debug`).

| Área | Estado | Riesgo |
|---|---|---|
| Migraciones FinSaaS | ⚠️ Sucio | Múltiples logs de fallo (`migration_error_rls.log`). |
| Migraciones Banking | ✅ OK | Módulo aislado. |
| Migraciones Ventas | ❓ Incierto | Dependiente de scripts manuales de seeding. |

---

## 5) Estado de Storage y Archivos

**Estrategia Actual:** "Fail-safe Local con Redirección".
Codigo: `backend/index.js` (L175-206) y `src/core/config/storage.js`.

1. **Intenta leer local:** Busca en `/app/backend/uploads`.
2. **Si falla:** Verifica `REMOTE_STORAGE_URL`.
3. **Redirección:** Si existe remoto, hace 302 hacia allá. Si no, 404.

| Módulo | Estrategia actual | Estado | Riesgo |
|---|---|---|---|
| Documentos FinSaaS | FS Local + Redirect | 🛑 CRÍTICO | **Datos Efímeros en Prod.** Si no hay Volume montado, los uploads nuevos se borran al desplegar. |
| Banking Imports | FS Local | ⚠️ Medio | Archivos temporales de proceso (csv/pdf), menos crítico si se borran post-proceso. |
| Otros uploads | FS Local | 🛑 CRÍTICO | Pérdida de avatares/adjuntos en cada deploy. |

---

## 6) Código y ramas (qué hizo el compañero)
**Rama activa:** `main` (asumida por contexto de hotfix).
**Última actividad detectada:**
- **Refactor Modular:** Creación de `src/modules` (banking, contable).
- **Hardening Prod:** Adición de chequeos de entorno en `index.js`.
- **CORS Fix:** Configuración manual de lista blanca en `index.js`.
- **Debugging Migraciones:** Generación masiva de logs de debug (`migration_log_*.txt`).

---

## 7) Riesgos actuales (NO históricos)

1. **🔴 CRÍTICO: Persistencia de Archivos**
   - El sistema usa `backend/uploads` localmente.
   - En Railway/Netlify containerizado, **esto es efímero**.
   - Los usuarios perderán sus subidas horas después de subirlas si se redesp(lega).

2. **🟠 MEDIO: Deuda Técnica Migraciones**
   - La carpeta `backend` está contaminada con docenas de scripts `run_migration.js` y logs. Dificulta saber el estado real de la DB sin un dump.

3. **🟠 MEDIO: Rutas Mixtas (V1 vs V2)**
   - Coexistencia de `routes/facturas.js` (legacy) y `src/modules/contable` (nuevo). Riesgo de que endpoints distintos toquen las mismas tablas con lógica diferente.

---

## 8) Resumen Ejecutivo

- ✅ **Estable:** Infraestructura base, conexión DB, Login y Auth (Google/JWT).
- ✅ **Protegido:** Variables de entorno y CORS en sus configuraciones básicas.
- 🚧 **En Progreso:** Migración a arquitectura modular (FinSaaS avanzado, resto legacy).
- 🛑 **Cuello de Botella:** **Sistema de Archivos (Storage)**. No es apto para producción escalable (es efímero). Se requiere migrar a S3/Blob storage urgente o configurar Volumes persistentes.
- ⚠️ **Limpieza:** El directorio raíz del backend requiere limpieza urgente de scripts de migración manuales y logs de error.
