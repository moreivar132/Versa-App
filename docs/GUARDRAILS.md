# Guardrails y Calidad (Versa V2)

Este documento establece las líneas rojas y el estándar de calidad que debe cumplir cada cambio de código.

## 🚫 Prohibiciones (Hard Guards)
1.  **NO SQL en Rutas/Controllers**: Las consultas deben vivir exclusivamente en `repositories/`.
2.  **NO Lógica de Negocio en Frontend**: El frontend solo muestra datos y envía inputs. Los cálculos de precios, validaciones de stock y reglas de negocio viven en el Backend (Services).
3.  **NO Hardcoded Secrets**: Nunca subir claves de API o credenciales. Usar `.env`.
4.  **NO Queries Cross-Module**: Un repositorio no puede consultar tablas de otro módulo. Usar la API pública del módulo destino.
5.  **NO Auth Bypass**: Cada nuevo endpoint debe pasar por el middleware de autenticación y validación de tenant a menos que sea explícitamente público (ej: login).

## ✅ Definition of Done (DoD)
Para dar una tarea por terminada, debe cumplir:
- [ ] El código sigue la estructura `Controller -> Service -> Repository`.
- [ ] No hay logs de debug (`console.log`) en producción.
- [ ] Se han actualizado/creado los tests unitarios para la lógica nueva.
- [ ] Se ha verificado que el aislamiento multi-tenant funciona correctamente.
- [ ] La documentación del módulo (en `/docs/MODULES/`) ha sido actualizada si hubo cambios en la API o esquema.

## 🔍 Guía de Revisión de PRs
Al revisar un Pull Request, busca:
- **Acoplamiento**: ¿Este PR introduce una dependencia circular?
- **Seguridad**: ¿Se está validando el `id_tenant` en las queries?
- **Escalabilidad**: ¿Hay una query dentro de un loop? (Problema N+1).
- **Consistencia**: ¿Los nombres de las variables y funciones siguen el estándar del proyecto?

---

*"Si no tiene tests y rompe el aislamiento entre módulos, no se mergea."*
