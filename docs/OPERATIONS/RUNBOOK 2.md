# 📖 RUNBOOK de Operaciones — VERSA

Este documento contiene los procedimientos de emergencia para el equipo de desarrollo.

---

## 🚨 Procedimiento de Rollback (Vuelta Atrás)

### ¿Cuándo usar este procedimiento?
- La aplicación no carga después de un despliegue.
- Los clientes reportan errores 500 masivos.
- Una funcionalidad crítica (facturas, pagos, login) deja de funcionar.

### Pasos para Rollback

#### Opción A: Rollback via Git (Recomendado)
```bash
# 1. Ver los últimos commits
git log --oneline -10

# 2. Identificar el commit ANTERIOR al despliegue problemático
# Ejemplo: abc1234 es el último "bueno"

# 3. Crear una rama de emergencia y revertir
git checkout -b hotfix/rollback-YYYYMMDD
git revert HEAD --no-edit

# 4. Push inmediato (el CI validará antes de desplegar)
git push origin hotfix/rollback-YYYYMMDD

# 5. Crear Pull Request de emergencia y mergear
```

#### Opción B: Rollback via Plataforma de Hosting
Si usas Railway/Render/Vercel:
1. Ir al dashboard de la plataforma.
2. Buscar la sección de "Deployments" o "Despliegues".
3. Localizar el despliegue anterior que funcionaba.
4. Hacer clic en "Redeploy" o "Rollback".

### Rollback de Base de Datos (Migraciones)
⚠️ **PRECAUCIÓN:** Solo usar si la migración causó el problema.

```bash
# 1. Conectar al backend
cd backend

# 2. Ver estado de migraciones
npm run migrate:status

# 3. Revertir la última migración
npm run migrate:rollback

# 4. Verificar que la aplicación funciona
curl https://tu-dominio.com/api/health
```

---

## 🔍 Verificación Post-Despliegue

### Smoke Test Manual
Después de cada despliegue, verificar manualmente:

| Check | URL/Acción | Esperado |
|-------|------------|----------|
| Health | `GET /api/health` | `{ "ok": true }` |
| Auth | Intentar login | Token JWT válido |
| FinSaaS | Listar empresas | Lista sin error |
| Manager | Ver órdenes | Lista sin error |

### Smoke Test Automático
```bash
# Verificar que el servidor responde
curl -f https://tu-dominio.com/api/health || echo "❌ FALLO"

# Verificar conexión a DB
curl -f https://tu-dominio.com/api/db-test || echo "❌ DB FALLO"
```

---

## 📞 Contactos de Emergencia

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Tech Lead | [COMPLETAR] | [COMPLETAR] |
| DevOps | [COMPLETAR] | [COMPLETAR] |
| Producto | [COMPLETAR] | [COMPLETAR] |

---

## 📋 Checklist Post-Incidente

Después de resolver una emergencia, completar:

- [ ] Incidente documentado en Issues/Notion
- [ ] Root Cause Analysis (¿Por qué pasó?)
- [ ] Acción correctiva identificada
- [ ] Test añadido para prevenir recurrencia
- [ ] Comunicación a clientes afectados (si aplica)

---

*Última actualización: 2026-01-22*
