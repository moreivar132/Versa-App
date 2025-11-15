# Versa-Finanzas
Trata de un portal con validación de usuarios para subir y gestionar datos contables —facturas y movimientos manuales— con un dashboard financiero. El frontend está desarrollado en HTML, CSS y JavaScript, y el backend se integra con Make para conectar Google Sheets, Drive y OpenAI Vision, automatizando el registro y clasificación de gastos.

## Acceso y roles

- **Administrador predeterminado:** `admin@versa.com` / `VersaAdmin#2024`. Inicia sesión con estas credenciales y cámbialas desde el área de administración.
- Los administradores pueden crear cuentas de empleados u otros administradores, generar contraseñas robustas y revocar accesos.
- Las contraseñas se almacenan localmente usando un hash SHA-256 con sal aleatoria generada en el navegador..