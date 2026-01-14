# Migraciones de Base de Datos — VERSA

Este documento describe el sistema de migraciones basado en **Knex.js**.

> **Fecha de adopción:** 2026-01-13  
> **Estado:** ✅ Activo

---

## 1. Comandos Principales

Ejecutar desde `backend/`:

```bash
# Ejecutar todas las migraciones pendientes
npm run migrate:latest

# Ver estado de las migraciones
npm run migrate:status

# Revertir la última migración (batch)
npm run migrate:rollback

# Crear una nueva migración
npm run migrate:make nombre_descriptivo

# Ejecutar solo la siguiente migración pendiente
npm run migrate:up

# Revertir solo la última migración
npm run migrate:down

# Ejecutar seeds (datos iniciales)
npm run seed:run
```

---

## 2. Estructura de Directorios

```
backend/
├── knexfile.js              # Configuración Knex (entornos)
├── db/
│   ├── migrations/          # ✅ Migraciones Knex (OFICIAL)
│   │   ├── 20260113000000_baseline.js
│   │   ├── 20260113170000_enable_rls_phase1.js
│   │   └── ... (futuras migraciones)
│   └── seeds/               # Seeds de datos (opcional)
├── legacy/
│   └── sql-migrations/      # ⚠️ Scripts antiguos (REFERENCIA)
│       ├── README.md
│       └── *.sql / *.js
└── migrations/              # ⚠️ DEPRECATED - No usar directamente
```

---

## 3. Convención de Nombres

Las migraciones usan el formato:

```
YYYYMMDDHHMMSS_descripcion_accion.js
```

Ejemplos:
- `20260113170000_enable_rls_phase1.js`
- `20260115100000_add_column_orden_tenant.js`
- `20260120090000_create_audit_table.js`

**Reglas:**
- Usar snake_case
- Ser descriptivo pero conciso
- Incluir la acción (create, add, remove, alter, enable, fix)

---

## 4. Anatomía de una Migración

```javascript
/**
 * Descripción breve de la migración
 * 
 * @see docs/ALGO.md si aplica
 */

exports.up = async function(knex) {
  // Cambios a aplicar
  await knex.schema.createTable('mi_tabla', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('id_tenant').notNullable().references('tenant.id');
    table.string('nombre', 255).notNullable();
    table.timestamps(true, true);
  });
  
  // O con SQL crudo:
  await knex.raw(`
    ALTER TABLE mi_tabla ADD COLUMN nuevo TEXT;
  `);
};

exports.down = async function(knex) {
  // Revertir cambios
  await knex.schema.dropTableIfExists('mi_tabla');
  
  // O con SQL:
  await knex.raw(`
    ALTER TABLE mi_tabla DROP COLUMN nuevo;
  `);
};
```

---

## 5. Políticas y Reglas

### ✅ SÍ hacer:

1. **Toda migración debe tener `down()`** (aunque sea un log de warning si es irreversible)
2. **Probar primero en desarrollo** antes de staging/producción
3. **Una migración = un cambio lógico** (no mezclar features)
4. **Incluir índices** en columnas que se consultan frecuentemente
5. **Comentar migraciones complejas** con referencias a documentación

### ❌ NO hacer:

1. **NO ejecutar scripts sueltos** de `migrations/` o `legacy/` en producción
2. **NO modificar migraciones ya ejecutadas** (crear una nueva para corregir)
3. **NO hacer backfills masivos** en la migración (usar seeds o scripts separados)
4. **NO mezclar DDL y DML** en la misma migración cuando sea evitable
5. **NO borrar migraciones** ya desplegadas (rompe el tracking)

---

## 6. Backfills (Poblado de Datos)

Para poblar datos existentes:

```javascript
exports.up = async function(knex) {
  // 1. Añadir columna nullable primero
  await knex.schema.alterTable('mi_tabla', (table) => {
    table.bigInteger('nueva_columna').nullable();
  });
  
  // 2. Backfill en batches pequeños
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const rows = await knex('mi_tabla')
      .whereNull('nueva_columna')
      .limit(batchSize)
      .offset(offset);
    
    if (rows.length === 0) {
      hasMore = false;
      continue;
    }
    
    for (const row of rows) {
      await knex('mi_tabla')
        .where('id', row.id)
        .update({ nueva_columna: calcularValor(row) });
    }
    
    offset += batchSize;
    console.log(`Backfill: ${offset} rows procesadas`);
  }
  
  // 3. Hacer NOT NULL solo después del backfill
  await knex.schema.alterTable('mi_tabla', (table) => {
    table.bigInteger('nueva_columna').notNullable().alter();
  });
};
```

---

## 7. Baseline y DB Existentes

El archivo `20260113000000_baseline.js` marca el punto de partida.

### Para una DB existente (producción/staging):

1. Ejecutar `npm run migrate:latest` - Knex creará la tabla `knex_migrations`
2. Si la migración `baseline` detecta tablas existentes, marca el estado correcto
3. Las migraciones futuras se ejecutarán normalmente

### Para una DB nueva (desarrollo):

1. Ejecutar los scripts de `legacy/sql-migrations/` en orden (ver README allí)
2. Luego ejecutar `npm run migrate:latest`

---

## 8. Troubleshooting

### Error: "Migration has already been run"
La migración ya está registrada. Usa `migrate:status` para verificar.

### Error: "Migration is missing"
Alguien borró una migración que ya se ejecutó. NO BORRAR migraciones.

### Error en producción durante migración
1. Revisar logs
2. Si es posible, ejecutar `npm run migrate:rollback`
3. Si no, corregir manualmente y marcar la migración como ejecutada:
   ```sql
   INSERT INTO knex_migrations (name, batch, migration_time)
   VALUES ('NOMBRE_MIGRACION.js', (SELECT MAX(batch)+1 FROM knex_migrations), NOW());
   ```

### Ver qué migraciones se ejecutaron
```sql
SELECT * FROM knex_migrations ORDER BY id DESC;
```

---

## 9. Integración con CI/CD (Futuro)

En el workflow de GitHub Actions:

```yaml
- name: Run Migrations
  run: |
    cd backend
    npm run migrate:latest
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 10. Referencias

- [Knex.js Migrations](https://knexjs.org/guide/migrations.html)
- [docs/RLS_PLAN.md](./RLS_PLAN.md) — Row Level Security
- [docs/GUARDRAILS.md](./MODULES/GUARDRAILS.md) — Reglas de código
- [legacy/sql-migrations/README.md](../backend/legacy/sql-migrations/README.md) — Scripts antiguos
