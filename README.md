# Versa-App

## Setup
1. Install dependencies from the project root; this will also install the backend packages automatically:
   ```bash
   npm install
   ```

## Ejecutar
- Servidor en modo producción/local:
  ```bash
  npm start
  ```
- Servidor en modo desarrollo (con reinicio automático):
  ```bash
  npm run dev
  ```

El backend levanta en el puerto `3000` y sirve `frontend/login.html` en `/`, `/login` y `/login.html`. Asegúrate de que no haya otro servicio usando ese puerto antes de abrir `http://localhost:3000/login.html` en el navegador.
