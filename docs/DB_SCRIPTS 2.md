# DB_SCRIPTS.md

**Fecha:** 2026-01-15  
**Última revisión:** CRIT-FIX-00

---

## Estructura de Migraciones y Scripts SQL

### Directorio Oficial: `backend/db/migrations/`
Gestionado por **Knex.js**. Usar `npm run migrate:latest` para ejecutar.

| Archivo | Propósito |
|---------|-----------|
| `20260113000000_baseline.js` | Línea base del esquema |
| `20260113170000_enable_rls_phase1.js` | Habilita Row Level Security fase 1 |
| `20260113180000_add_clientes_vehiculos_permissions.js` | Permisos V2 |
| `20260115000000_fiscal_profile.js` | Perfiles fiscales FinSaaS |
| `20260115000001_tax_rules_es.js` | Reglas de IVA España |
| `20260115000002_alter_factura_fiscal.js` | Campos fiscales en facturas |

---

### Directorio Legacy: `backend/migrations/`
Scripts SQL manuales (NO gestionados por Knex). Ejecutar con `psql` o script específico.

| Archivo | Propósito | ¿Ejecutado? |
|---------|-----------|-------------|
| `create_rbac_tables.sql` | Tablas RBAC | ✅ |
| `enable_rls_phase1.sql` | RLS manual | ✅ |
| `create_contabilidad_v3.sql` | Tablas contabilidad | ✅ |
| `create_accounting_empresa.sql` | Multi-empresa | ✅ |
| `create_open_banking_tables.sql` | Open Banking | ✅ |
| `create_marketplace_tables.sql` | Marketplace | ✅ |
| `create_fidelizacion_tables.sql` | Fidelización | ✅ |
| `create_facturacion_tables.sql` | Facturación taller | ✅ |
| Otros `create_*.sql` | Varios módulos | ✅ |

> **⚠️ NO ejecutar estos SQL directamente en producción.** Usar scripts runners (`run_*_migration.js`) o migrar a Knex.

---

### Directorio de Scripts: `backend/scripts/`
Scripts de utilidad, seeding, y mantenimiento.

| Subdirectorio | Propósito |
|---------------|-----------|
| `scripts/debug/` | Diagnóstico y debugging |
| `scripts/emergency/` | Scripts de emergencia |
| `scripts/maintenance/` | Mantenimiento periódico |
| `scripts/migrations_legacy/` | Migraciones históricas |

---

### Scripts en Root (`backend/`)
Scripts ad-hoc que deberían moverse a `scripts/`:

| Archivo | Propósito | Acción Sugerida |
|---------|-----------|-----------------|
| `ejecutar_migracion_*.js` | Runners de migración | Mover a `scripts/` |
| `configurar_*.js` | Configuración inicial | Mover a `scripts/` |
| `check-*.js` | Verificación de tablas | Mover a `scripts/` |
| `diag*.js` | Diagnóstico | Mover a `scripts/debug/` |

---

## Comandos de Migración

```bash
# Ver estado de migraciones Knex
npm run migrate:status

# Ejecutar migraciones pendientes
npm run migrate:latest

# Rollback última migración
npm run migrate:rollback

# Crear nueva migración
npm run migrate:make nombre_migracion
```

---

## Reglas de Oro

1. **Nuevas migraciones** → Siempre en `backend/db/migrations/` usando Knex
2. **SQL manual** → Solo para emergencias, documentar en este archivo
3. **Nunca ejecutar SQL crudo** en producción sin revisión
4. **Scripts en root** → Progresivamente mover a `scripts/`
