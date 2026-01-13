# Módulo Template

## Descripción
Este es un módulo de plantilla. Copia esta carpeta completa para crear un nuevo módulo.

## Estructura
```
módulo/
├── module.routes.js      # Definición de endpoints
├── module.controller.js  # Handlers HTTP
├── module.service.js     # Lógica de negocio
├── module.repo.js        # Acceso a datos
├── module.schemas.js     # Validación de datos
├── docs.md               # Esta documentación
└── __tests__/
    └── smoke.test.js     # Tests básicos
```

## Cómo usar

### 1. Copiar la carpeta
```bash
cp -r src/modules/_template src/modules/mi-modulo
```

### 2. Renombrar archivos
```bash
cd src/modules/mi-modulo
for f in module.*; do mv "$f" "${f/module/mi-modulo}"; done
```

### 3. Actualizar imports
En cada archivo, actualizar los `require('./module.X')` a `require('./mi-modulo.X')`.

### 4. Modificar la tabla
En `mi-modulo.repo.js`, cambiar `TABLE_NAME` por el nombre real de tu tabla.

### 5. Registrar en index.js
Cuando estés listo para integrar (NO en este paso del scaffold):
```javascript
// En backend/index.js
app.use('/api/mi-modulo', require('./src/modules/mi-modulo/mi-modulo.routes'));
```

## Convenciones

- **Tenant Isolation**: Todas las queries DEBEN filtrar por `id_tenant`
- **Error Handling**: Usar las clases de error de `core/http/middlewares/error-handler.js`
- **Logging**: Usar el logger de `core/logging/logger.js`
- **Validación**: Usar las utilidades de `core/validation/index.js`

## Tests
Los tests smoke verifican que el módulo carga sin errores:
```bash
npm test -- --testPathPattern="mi-modulo"
```
