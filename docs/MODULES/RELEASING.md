# Proceso de Release (Versiones)

Este documento describe cómo se gestionan las versiones y los deploys en VERSA.

## 1. Versionado (SemVer)

Seguimos [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **PATCH**: Corrección de errores que no cambian la funcionalidad.
- **MINOR**: Nueva funcionalidad que no rompe compatibilidad.
- **MAJOR**: Cambios sustanciales o cambios que rompen la compatibilidad (breaking changes).

## 2. Pasos para un nuevo Release

1. **Pruebas Finales**: Asegurarse de que `npm test` y `npm run build` pasan en `main`.
2. **Actualizar Versión**:
   ```bash
   npm version patch  # o minor/major
   ```
   *Nota: Esto actualizará el package.json y creará un tag de git.*
3. **Push Tags**:
   ```bash
   git push origin main --tags
   ```
4. **Deploy**: El deploy se dispara automáticamente hacia Railway desde la rama `main` tras pasar el CI.

## 3. Estrategia de Rollback

Si una versión causa errores críticos en producción:

### Opción A: Revertir Commit
1. Identificar el commit estable anterior.
2. Revertir el commit problemático:
   ```bash
   git revert <commit_hash>
   git push origin main
   ```

### Opción B: Railway Rollback
1. Ir al panel de [Railway](https://railway.app).
2. Seleccionar el deploy anterior y hacer click en "Rollback".

## 4. Checklist de Release
- [ ] Changelog actualizado (opcional).
- [ ] Base de datos migrada (si hubo cambios de esquema).
- [ ] Variables de entorno configuradas en producción.
