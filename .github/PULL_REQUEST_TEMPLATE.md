## 🚀 Descripción del Cambio
<!--- Explicar qué se está implementando o arreglando --->

## 🛠️ Tipo de Cambio
- [ ] ✨ Nueva funcionalidad (feat)
- [ ] 🐛 Corrección de error (fix)
- [ ] 🧹 Refactorización (refactor)
- [ ] 📝 Documentación (docs)
- [ ] 🧪 Tests adicionales

## 📋 Checklist de Calidad
- [ ] 🏗️ El código compila localmente (`npm run build`).
- [ ] 🧹 He ejecutado el linter y no hay errores (`npm run lint`).
- [ ] 🧪 Los tests existentes pasan (`npm test`).
- [ ] 🔐 Si es un endpoint nuevo, he incluido los 3 tests críticos (OK, NoTenant, NoPerm).
- [ ] 📖 He actualizado la documentación (Swagger/Markdown) si aplica.

## 🔒 Seguridad (Multi-tenant)
- [ ] ¿Se usa `getTenantDb(ctx)` para acceso a datos?
- [ ] ¿Se valida el permiso RBAC en la ruta/controller?

## 📸 Evidencia (opcional)
<!-- Capturas de pantalla o ejemplos de curl -->

## ⚠️ Riesgos y Rollback
- **Riesgo**: <!-- Ej: afecta la tabla de ventas directamente -->
- **Rollback**: <!-- Ej: revertir el commit y restaurar backup si hubo migración -->
