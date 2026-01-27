# VERSA Database Migrations Playbook

> **Updated**: 2026-01-19  
> **Policy**: All DB changes MUST go through Knex migrations. SQL suelto prohibido.

---

## Quick Reference

```bash
# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate:latest

# Rollback last batch
npm run migrate:rollback

# Create new migration
npm run migrate:make my_migration_name

# Verify DB connection
npm run db:verify
```

---

## Migration Locations

| Directory | Purpose | Active? |
|-----------|---------|---------|
| `backend/db/migrations/` | **Official Knex migrations** | ✅ Yes |
| `backend/db/seeds/` | Seed data (optional) | ✅ Yes |
| `backend/migrations/` | ⚠️ Legacy/orphaned files | ❌ Do not use |
| `backend/legacy/sql-migrations-archive/` | Historical SQL reference | ❌ Archived |

---

## How to Run Migrations

### Local Development

```bash
cd backend
npm run migrate:latest
```

Expected output:
```
Batch 1 run: 10 migrations
```

### Staging / Production

1. **SSH into container or run in Railway shell**:
   ```bash
   cd /app  # or wherever backend is deployed
   npm run migrate:latest
   ```

2. **Or use Railway CLI**:
   ```bash
   railway run npm run migrate:latest
   ```

> [!WARNING]
> Always backup production database before running migrations.

---

## How to Create a New Migration

```bash
npm run migrate:make add_new_feature
```

This creates: `db/migrations/20260119120000_add_new_feature.js`

### Template

```javascript
/**
 * Migration: add_new_feature
 * Description: [What this migration does]
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating new feature...');
    
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS new_table (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `);
    
    console.log('[Migration] ✅ New feature created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Removing new feature...');
    
    await knex.raw(`
        DROP TABLE IF EXISTS new_table CASCADE;
    `);
    
    console.log('[Migration] ✅ New feature removed');
};

exports.config = { transaction: true };
```

---

## How to Rollback

### Rollback last batch

```bash
npm run migrate:rollback
```

### Rollback specific migration

```bash
npm run migrate:down -- --name 20260119_add_new_feature.js
```

> [!CAUTION]
> Some migrations are marked as **no-op down**. These cannot be safely rolled back because they modify data in ways that cannot be reversed. Check the migration file comments before rolling back.

---

## Best Practices

### ✅ DO

- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` for safety
- Wrap complex migrations in transactions (`exports.config = { transaction: true }`)
- Add clear comments explaining the purpose
- Test migrations locally before pushing

### ❌ DON'T

- Run raw SQL files directly on production
- Use `pool.query()` for migrations
- Skip the Knex migration system
- Modify the `knex_migrations` table manually
- Create migrations that depend on runtime data

---

## Troubleshooting

### Migration stuck / incomplete

```bash
# Check status
npm run migrate:status

# Force unlock if stuck
psql $DATABASE_URL -c "DELETE FROM knex_migrations_lock WHERE is_locked = true;"
```

### "Already exists" errors

This usually means the object was created outside of Knex. Options:
1. Add `IF NOT EXISTS` to the migration
2. Mark migration as complete manually (risky):
   ```sql
   INSERT INTO knex_migrations (name, batch, migration_time) 
   VALUES ('20260119_migration_name.js', 99, NOW());
   ```

### Tables out of sync

If production DB has tables that don't match migrations:
1. Generate a **baseline** migration that matches current state
2. Mark baseline as complete in `knex_migrations`
3. Continue with incremental migrations

---

## Policy: SQL Suelto Prohibido

> **Effective**: 2026-01-13

**All database schema changes** must be made through Knex migrations.

**Prohibited**:
- Direct `psql` commands on production
- Running `.sql` files manually
- Using `pool.query()` for schema changes
- Modifying tables via GUI tools

**Allowed**:
- Emergency read-only queries for debugging
- Data fixes via approved migration files

Contact the DB lead if you need to make emergency changes.

---

## Reference: Migration Naming

Format: `YYYYMMDDHHMMSS_description.js`

Examples:
- `20260115000000_create_fiscal_profile.js`
- `20260117120000_add_retenciones_to_factura.js`
- `20260119093000_fix_constraint_name.js`

---

## Support

- **Knex docs**: https://knexjs.org/guide/migrations.html
- **Project lead**: Check `docs/AUDITS/` for architecture decisions
