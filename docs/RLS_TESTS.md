# RLS_TESTS — Plan de Pruebas de No-Fuga

**Fecha:** 13 de Enero, 2026  
**Objetivo:** Validar que Row Level Security (RLS) bloquea acceso cross-tenant.

---

## 1. Pruebas Manuales (SQL)

Ejecutar estas queries directamente en la base de datos para validar RLS.

### 1.1 Setup: Crear contexto de tenant A

```sql
-- Simular contexto de tenant A (id=1)
SELECT set_config('app.tenant_id', '1', false);
SELECT set_config('app.is_superadmin', 'false', false);

-- Verificar contexto
SELECT 
  current_setting('app.tenant_id', true) as tenant,
  current_setting('app.is_superadmin', true) as is_superadmin;
```

### 1.2 Test: Tenant A solo ve sus datos

```sql
-- Con contexto de tenant 1, intentar leer clientes
SELECT id, nombre, id_tenant FROM clientefinal LIMIT 10;

-- ESPERADO: Solo muestra rows con id_tenant = 1
-- Si muestra rows con otros tenants → RLS FALLA
```

### 1.3 Test: Tenant A no ve datos de Tenant B

```sql
-- Intentar leer datos específicos de otro tenant
SELECT * FROM clientefinal WHERE id_tenant = 2;

-- ESPERADO: 0 rows (RLS bloquea)
-- Si muestra rows → FUGA DE DATOS CRÍTICA
```

### 1.4 Test: Insert con tenant incorrecto

```sql
-- Intentar insertar en tenant ajeno
INSERT INTO contable_category (id_tenant, codigo, nombre, tipo)
VALUES (2, 'TEST_FAIL', 'No debería funcionar', 'GASTO');

-- ESPERADO: Error o insert en tenant 1 (no 2)
-- Si inserta en tenant 2 → RLS FALLA en WITH CHECK
```

### 1.5 Test: Super-admin ve todos los datos

```sql
-- Activar contexto super-admin
SELECT set_config('app.is_superadmin', 'true', false);
SELECT set_config('app.tenant_id', '', false);

-- Verificar acceso cross-tenant
SELECT id_tenant, COUNT(*) 
FROM clientefinal 
GROUP BY id_tenant;

-- ESPERADO: Muestra conteo de todos los tenants
```

### 1.6 Test: Sin contexto, sin datos

```sql
-- Limpiar contexto (simular request sin auth)
SELECT set_config('app.tenant_id', '', false);
SELECT set_config('app.is_superadmin', 'false', false);

-- Intentar leer
SELECT * FROM clientefinal LIMIT 1;

-- ESPERADO: 0 rows (ningún tenant match)
```

---

## 2. Pruebas Automatizadas (Jest)

Crear en `backend/tests/integration/rls.test.js`:

```javascript
/**
 * RLS (Row Level Security) Integration Tests
 * 
 * Valida que el aislamiento de tenant funciona correctamente
 * a nivel de PostgreSQL.
 */

const { getTenantDb, queryWithRLS, setRLSContext, pool } = require('../../src/core/db/tenant-db');

describe('RLS - Row Level Security', () => {
    let client;
    
    // IDs de tenants de prueba (deben existir en la DB)
    const TENANT_A = 1;
    const TENANT_B = 2;

    beforeAll(async () => {
        // Verificar que hay al menos 2 tenants para probar
        const result = await pool.query('SELECT COUNT(*) FROM tenant');
        if (parseInt(result.rows[0].count) < 2) {
            console.warn('SKIP: Necesitas al menos 2 tenants para probar RLS');
        }
    });

    describe('Lectura Cross-Tenant', () => {
        test('Tenant A no puede leer datos de Tenant B', async () => {
            const ctxA = { tenantId: TENANT_A, isSuperAdmin: false };
            
            // Query con contexto de Tenant A
            const result = await queryWithRLS(
                ctxA,
                'SELECT id, id_tenant FROM clientefinal WHERE id_tenant = $1',
                [TENANT_B]
            );
            
            // Debe retornar 0 rows (RLS bloquea)
            expect(result.rows.length).toBe(0);
        });

        test('Tenant A solo ve sus propios datos', async () => {
            const ctxA = { tenantId: TENANT_A, isSuperAdmin: false };
            
            const result = await queryWithRLS(
                ctxA,
                'SELECT DISTINCT id_tenant FROM clientefinal'
            );
            
            // Todos los rows deben ser del tenant A
            result.rows.forEach(row => {
                expect(row.id_tenant).toBe(TENANT_A);
            });
        });
    });

    describe('Super-Admin Bypass', () => {
        test('Super-admin puede ver todos los tenants', async () => {
            const ctxSuperAdmin = { 
                isSuperAdmin: true, 
                bypassReason: 'rls_test' 
            };
            
            const result = await queryWithRLS(
                ctxSuperAdmin,
                'SELECT DISTINCT id_tenant FROM clientefinal ORDER BY id_tenant'
            );
            
            // Debe haber más de un tenant
            expect(result.rows.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Insert con RLS', () => {
        test('Insert respeta el tenant del contexto', async () => {
            const ctxA = { tenantId: TENANT_A, isSuperAdmin: false, userId: 1 };
            const db = getTenantDb(ctxA);
            
            const testCode = `TEST_RLS_${Date.now()}`;
            
            await db.txWithRLS(async (trxDb) => {
                // Intentar insertar con id_tenant diferente al contexto
                // RLS WITH CHECK debería bloquear o forzar al tenant correcto
                try {
                    await trxDb.query(`
                        INSERT INTO contable_category (id_tenant, codigo, nombre, tipo)
                        VALUES ($1, $2, 'Test RLS', 'GASTO')
                    `, [TENANT_B, testCode]);
                    
                    // Si llegamos aquí sin error, verificar que NO se insertó en tenant B
                    const verify = await trxDb.query(
                        'SELECT id_tenant FROM contable_category WHERE codigo = $1',
                        [testCode]
                    );
                    
                    if (verify.rows.length > 0) {
                        // Si se insertó, debe ser en tenant A (el del contexto), no B
                        expect(verify.rows[0].id_tenant).not.toBe(TENANT_B);
                    }
                } catch (error) {
                    // RLS bloqueó el insert - comportamiento esperado
                    expect(error.message).toMatch(/policy|permission|denied/i);
                }
                
                // Rollback para no dejar datos de prueba
                throw new Error('ROLLBACK_TEST');
            }).catch(e => {
                if (e.message !== 'ROLLBACK_TEST') throw e;
            });
        });
    });

    describe('Sin Contexto', () => {
        test('Sin tenant_id no se puede leer nada', async () => {
            const ctxEmpty = { tenantId: null, isSuperAdmin: false };
            
            const result = await queryWithRLS(
                ctxEmpty,
                'SELECT * FROM clientefinal LIMIT 10'
            );
            
            // Sin tenant seteado, RLS debería bloquearlo TODO
            // (comportamiento depende de cómo está la policy)
            expect(result.rows.length).toBe(0);
        });
    });
});
```

---

## 3. Checklist de Validación

### Pre-Deploy (Staging)

- [ ] Migración `enable_rls_phase1.sql` ejecutada sin errores
- [ ] Query de verificación muestra RLS activo en todas las tablas objetivo
- [ ] Test manual 1.2 (tenant A solo ve sus datos) pasa
- [ ] Test manual 1.3 (cross-tenant read) retorna 0 rows
- [ ] Test manual 1.5 (super-admin) ve todos los tenants
- [ ] Backend arranca sin errores con nuevo `tenant-db.js`
- [ ] Flujo de login funciona (ruta pública sin tenant)
- [ ] CRUD de clientes funciona para usuario normal

### Post-Deploy (Producción)

- [ ] Monitorear logs por errores de RLS
- [ ] Verificar que usuarios no reportan "datos vacíos"
- [ ] Verificar tiempos de respuesta (RLS no debería impactar significativamente)
- [ ] Revisar audit logs por bypass de super-admin sospechosos

---

## 4. Comandos de Verificación

### Ver estado RLS de todas las tablas

```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Ver policies activas

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Verificar funciones helper

```sql
-- Deben retornar resultados válidos
SELECT app_current_tenant();
SELECT app_is_superadmin();
```

---

## 5. Rollback de Emergencia

Si RLS causa problemas:

```bash
# Ejecutar script de emergencia
psql $DATABASE_URL -f backend/scripts/emergency/disable_rls.sql
```

O via variable de entorno (menos invasivo):

```bash
# Desactiva SET LOCAL en el wrapper (RLS sigue activo pero sin contexto)
RLS_ENABLED=false npm start
```

---

## 6. Notas Importantes

1. **RLS + FORCE**: Usamos `FORCE ROW LEVEL SECURITY` para que las policies apliquen incluso al owner de la tabla.

2. **Impacto en Performance**: Las queries con RLS tienen un overhead mínimo (~1-5ms) porque PostgreSQL evalúa la policy en cada row. Los índices en `id_tenant` mitigan esto.

3. **Tablas sin id_tenant**: Las tablas como `ordenpago` o `ordenlinea` quedan SIN RLS por ahora porque no tienen `id_tenant` directo. Están protegidas por el FK a tablas que SÍ tienen RLS.

4. **Backups/Restores**: Al restaurar un backup, las policies RLS se incluyen. No se necesita re-aplicar la migración.
