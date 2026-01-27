# ANTIGRAVITY — Explicación de Advertencias en Consola

## 1. ⚠️ Advertencia de Tailwind (Amarilla)
> *"cdn.tailwindcss.com should not be used in production..."*

- **Qué significa**: Estás usando Tailwind CSS (la librería de estilos) a través de un enlace web ("CDN") en lugar de tenerlo instalado en el proyecto.
- **¿Es grave?**: **No**. Para desarrollo y prototipado es perfectamente normal.
- **Por qué sale**: El enlace CDN es "pesado" porque carga todo el motor de estilos en el navegador. En una app final (Producción), lo ideal es "compilar" los estilos para que la web cargue más rápido.
- **Acción**: Puedes ignorarla por ahora. Cuando el proyecto esté terminado, optimizaremos esto.

## 2. ℹ️ Log de Auth Service (Negro/Gris)
> *"Auth Service API URL: http://localhost:3000"*

- **Qué significa**: Esto es **BUENO**. Es un mensaje que hemos puesto nosotros para confirmar a qué backend se está conectando el frontend.
- **Confirmación**: Nos dice que tu frontend está leyendo bien la configuración y sabe que el backend está en tu máquina (`localhost`), no en la nube.
- **Acción**: Ninguna. Es una señal de que todo está bien conectado.
