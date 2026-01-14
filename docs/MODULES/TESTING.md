# Testing (VERSA Backend)

## Quick Start

```bash
# Correr todos los tests
npm test

# Correr tests en modo watch (desarrollo)
npm run test:watch

# Correr tests con coverage
npm run test:coverage

# Correr solo tests críticos (ventas, ordenes, caja)
npm run test:critical
```

## Estructura de Tests

```
backend/
├── tests/
│   ├── setup.js              # Configuración global de Jest
│   ├── helpers/
│   │   └── auth.js           # Helpers para autenticación en tests
│   ├── unit/                 # Tests unitarios
│   ├── integration/          # Tests de integración
│   └── ventas.smoke.test.js  # Smoke tests del módulo ventas
├── src/modules/
│   └── <modulo>/
│       └── __tests__/        # Tests específicos del módulo
│           └── smoke.test.js
```

## Variables de Entorno

Los tests usan las mismas variables que desarrollo, pero con la base de datos mockeada por defecto.

| Variable | Uso en Tests |
|----------|-------------|
| `JWT_SECRET` | Se usa el valor de .env o fallback 'test-jwt-secret-for-testing' |
| `NODE_ENV` | Set a 'test' automáticamente por Jest |
| `DATABASE_URL` | No se usa - DB está mockeada |

## Escribir Tests por Módulo

### Regla: Cada módulo migrado debe tener mínimo 3 tests

1. **Test OK** - Request autenticada funciona correctamente
2. **Test sin Auth** - Request sin token retorna 401
3. **Test sin Tenant** - Request con token pero sin tenant retorna 403

### Plantilla para nuevos módulos

```javascript
// tests/<modulo>.smoke.test.js

const request = require('supertest');
const { authHeaders, noAuthHeaders, noTenantHeaders } = require('./helpers/auth');

// Mock de base de datos
jest.mock('../db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn()
    })
}));

const { app } = require('../src/app');

describe('Módulo <NombreModulo> - Smoke Tests', () => {
    
    describe('Test 1: OK', () => {
        it('GET /api/<modulo> retorna 200 con auth', async () => {
            const res = await request(app)
                .get('/api/<modulo>')
                .set(authHeaders({ id: 1, id_tenant: 1 }));
            
            expect(res.status).toBe(200);
        });
    });

    describe('Test 2: Sin Auth', () => {
        it('GET /api/<modulo> retorna 401 sin token', async () => {
            const res = await request(app)
                .get('/api/<modulo>')
                .set(noAuthHeaders());
            
            expect(res.status).toBe(401);
        });
    });

    describe('Test 3: Sin Tenant', () => {
        it('GET /api/<modulo> retorna 403 sin tenant', async () => {
            const res = await request(app)
                .get('/api/<modulo>')
                .set(noTenantHeaders());
            
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TENANT_REQUIRED');
        });
    });
});
```

## Helpers de Autenticación

### `authHeaders(userOverrides)`
Genera headers con token JWT válido.

```javascript
const { authHeaders } = require('./helpers/auth');

// Usuario básico
const headers = authHeaders({ id: 1, id_tenant: 1 });

// Super admin
const superHeaders = authHeaders({ id: 99, is_super_admin: true });
```

### `noAuthHeaders()`
Headers sin token - para probar 401.

### `noTenantHeaders()`
Token válido pero sin id_tenant - para probar 403 TENANT_REQUIRED.

## Mocking de Base de Datos

Por defecto, la DB está mockeada en `tests/setup.js`. Para tests de integración reales:

```javascript
// Desactivar mock para un test específico
jest.unmock('../db');
const pool = require('../db');

// Recordar limpiar después del test
afterAll(async () => {
    await pool.end();
});
```

## Convenciones

### Naming
- `*.test.js` - Tests generales
- `*.spec.js` - Tests de especificación/comportamiento
- `*.smoke.test.js` - Smoke tests (pruebas básicas de funcionamiento)

### Assertions
- Usar `expect(response.status).toBe(...)` para status codes
- Usar `expect(response.body).toHaveProperty(...)` para validar estructura
- Evitar assertions "brittle" sobre valores exactos de datos

### Orden de Tests
1. Tests de casos exitosos (happy path)
2. Tests de validación (400)
3. Tests de autenticación (401)
4. Tests de autorización (403)
5. Tests de errores (500)

## CI/CD

Los tests corren automáticamente en:
- Push a main/develop
- Pull Requests

El pipeline fallaen si:
- Algún test falla
- (futuro) Coverage baja del umbral mínimo

## Troubleshooting

### "Cannot find module"
Verificar que el path en el mock sea correcto relativo al archivo de test.

### "Async callback was not invoked"
Agregar `--detectOpenHandles` al comando de jest (ya está en scripts).

### Tests colgados
La mayoría de veces es por conexiones DB no cerradas. Verificar mocks o usar `afterAll(() => pool.end())`.
