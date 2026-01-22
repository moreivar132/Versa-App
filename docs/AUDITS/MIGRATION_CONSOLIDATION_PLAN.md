## DECISION — SOURCE OF TRUTH
**Carpeta activa elegida:** `backend/db/migrations`
**Razón:**
- **Evidencia 1 (backend/knexfile.js):** El archivo de configuración de Knex define explícitamente `directory: './db/migrations'` en la sección `migrations`.
- **Evidencia 2 (backend/package.json):** Los scripts `migrate:latest` ejecutan `knex migrate:latest`, el cual lee por defecto `knexfile.js`.
- **Evidencia 3 (Recencia/Estructura):** La carpeta contiene archivos con timestamp `20260113...` (muy recientes) y un `20260113000000_baseline.js`, indicando un intento de reinicio/baseline reciente.

**Carpetas NO activas (legacy/archive):**
- `backend/migrations`: contiene 57 archivos (frente a 18 en la activa). Probablemente migraciones antiguas acumuladas antes de una reestructuración del proyecto. Los timestamps son antiguos o mezclados.
- `backend/scripts`: contiene scripts sueltos, no migraciones gestionadas por Knex.

**Estado DRIFT:** **SI**
- Existe una carpeta `backend/migrations` con 57 archivos que Knex NO está leyendo actualmente. Esto significa que hay código de base de datos histórico que no se está aplicando en nuevos despliegues, o que ya fue aplicado manualmente y "olvidado" en el repo.

---

## INVENTARIO Y CLASIFICACIÓN

### A) Activas (Pertenecen a `backend/db/migrations`)
- `20260113000000_baseline.js`
- `20260113010000_create_subscription...`
- (Lista completa de los 18 archivos en `db/migrations`)

### B) Legacy/Archive (Pertenecen a `backend/migrations`)
- Todos los archivos en `backend/migrations` que NO estén duplicados en `db/migrations`.
- (Total ~57 archivos).

### C) Dudosas/Huérfanas
- `backend/scripts/*.js` (Scripts ad-hoc como `seed_billing_plans.js`, `run_enhance_templates_...`). Deben ser revisados para ver si son seeds (mover a `db/seeds`) o tareas one-off.

---

## PLAN DE CONSOLIDACIÓN (SAFE)

### Fase 0 — Verificación (read-only)
- [ ] Validar estado actual de Knex y conexiones
  - **Comando:** `cd backend && npm run migrate:status` (Requiere DB real, se hará cuando CI tenga DB).
  - **Resultado esperado:** Lista de migraciones "down" o "up" coincidente con `db/migrations`.
  - **Riesgo:** Si falla la conexión, no podemos saber el estado real de la DB de producción.

### Fase 1 — Consolidación en repo (controlada)
- [ ] Mover migraciones Legacy a carpeta de archivo (sin borrar aún)
  - **Qué se mueve:** Todo `backend/migrations/*` a `backend/db/migrations/archive_legacy/`.
  - **Qué NO se toca:** `backend/db/migrations/*.js` (las activas).
  - **Cómo validar:** Ejecutar `knex migrate:list` (dry-run) y asegurar que solo lista las 18 activas.

- [ ] Comparar y Unificar
  - **Acción:** Verificar si alguna migración de "legacy" falta en "baseline".
  - **Validación:** Revisar el contenido de `20260113000000_baseline.js`. Si incluye todo el esquema anterior, las legacy son seguras de archivar.

### Fase 2 — Alineación con entornos
- [ ] Bloquear ejecuciones accidentales
  - Añadir archivo `README.md` en `backend/db/migrations/archive_legacy` explicando que NO deben ejecutarse.

### Definición de Done
- [ ] `backend/migrations` no existe.
- [ ] Todo está en `backend/db/migrations`.
- [ ] `knexfile.js` sigue apuntando a `./db/migrations`.

---

## COMANDOS PROPUESTOS (NO EJECUTAR AQUÍ)

```bash
# 1. Crear carpeta de archivo dentro de la estructura canónica
mkdir -p backend/db/migrations/archive_legacy

# 2. Mover las migraciones antiguas para limpieza
git mv backend/migrations/* backend/db/migrations/archive_legacy/

# 3. Eliminar la carpeta antigua vacía
rmdir backend/migrations

# 4. Crear README de advertencia
echo "# ARCHIVE LEGACY\nEstas migraciones son históricas. NO ejecutar. Usar baseline." > backend/db/migrations/archive_legacy/README.md

# 5. Verificar que Knex sigue viendo solo las activas (requiere DB, dry run mental)
# (El patrón de knexfile suele ser recursivo false, o explícito. Knex por defecto no lee subcarpetas recursivamente a menos que se configure, lo cual protege "archive_legacy")
```

---

## 5) RIESGOS Y MITIGACIONES
*   **Riesgo:** Que `knexfile.js` esté configurado para leer recursivamente y trate de ejecutar las legacy movidas.
    *   *Mitigación:* Knex no lee recursivamente por defecto. Verificamos `knexfile.js` y no tiene `recursive: true`.
*   **Riesgo:** Que el `baseline` de `db/migrations` esté incompleto y al desplegar en limpio falten tablas.
    *   *Mitigación:* En Fase 2, se debe desplegar una DB vacía en local y correr `migrate:latest` para validar que la app arranca.
