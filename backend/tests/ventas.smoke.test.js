/**
 * Ventas Module - Smoke Tests
 * 
 * Tests críticos para validar:
 * 1. Caso OK (200) - Request autenticada con tenant
 * 2. Caso sin Auth (401) - Request sin token
 * 3. Caso sin Tenant (403) - Token sin id_tenant
 * 
 * Estos tests validan los "guardrails" de seguridad básicos.
 */

const request = require('supertest');
const { authHeaders, noAuthHeaders, noTenantHeaders } = require('./helpers/auth');

// Mock de la base de datos para evitar conexiones reales
jest.mock('../db', () => ({
    query: jest.fn().mockResolvedValue({
        rows: [
            {
                id: 1,
                fecha: new Date().toISOString(),
                total_neto: '100.00',
                estado: 'COMPLETADA',
                cliente_nombre: 'Test Client',
                sucursal_nombre: 'Test Branch'
            }
        ]
    }),
    connect: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
    }),
    end: jest.fn()
}));

// Importar app después del mock
const { app } = require('../src/app');

describe('Módulo Ventas - Smoke Tests', () => {

    describe('Test 1: Caso OK - Request autenticada con tenant', () => {
        it('GET /api/ventas debe retornar 200 con usuario autenticado', async () => {
            const response = await request(app)
                .get('/api/ventas')
                .set(authHeaders({ id: 1, id_tenant: 1 }))
                .query({ limit: 5 });

            expect(response.status).toBe(200);
            expect(response.body).toBeDefined();

            // Validar estructura básica del response
            // No validamos datos específicos porque usamos mock
            expect(response.body).toHaveProperty('ventas');
            expect(response.body).toHaveProperty('total');
        });

        it('Response incluye campos esperados de paginación', async () => {
            const response = await request(app)
                .get('/api/ventas')
                .set(authHeaders({ id: 1, id_tenant: 1 }))
                .query({ limit: 10, offset: 0 });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                limit: expect.any(Number),
                offset: expect.any(Number)
            });
        });
    });

    describe('Test 2: Sin Auth - Request sin token', () => {
        it('GET /api/ventas debe retornar 401 sin token', async () => {
            const response = await request(app)
                .get('/api/ventas')
                .set(noAuthHeaders());

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');

            // Validar que el mensaje de error es apropiado
            expect(response.body.error).toMatch(/token/i);
        });

        it('POST /api/ventas debe retornar 401 sin token', async () => {
            const response = await request(app)
                .post('/api/ventas')
                .set(noAuthHeaders())
                .send({ idSucursal: 1, idCliente: 1, lineas: [] });

            expect(response.status).toBe(401);
        });
    });

    describe('Test 3: Sin Tenant - Token sin id_tenant', () => {
        it('GET /api/ventas debe retornar 403 sin contexto de tenant', async () => {
            const response = await request(app)
                .get('/api/ventas')
                .set(noTenantHeaders());

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('ok', false);

            // Debe incluir código de error y requestId para trazabilidad
            expect(response.body).toHaveProperty('code', 'TENANT_REQUIRED');
        });

        it('Error sin tenant incluye requestId para trazabilidad', async () => {
            const response = await request(app)
                .get('/api/ventas')
                .set(noTenantHeaders());

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('requestId');
            expect(response.body.requestId).toBeDefined();
        });
    });

    describe('Validaciones adicionales de seguridad', () => {
        it('Los headers de respuesta incluyen X-Request-ID', async () => {
            const response = await request(app)
                .get('/api/ventas')
                .set(authHeaders({ id: 1, id_tenant: 1 }));

            expect(response.headers).toHaveProperty('x-request-id');
        });
    });
});

describe('Health Check', () => {
    it('GET /api/health debe retornar 200', async () => {
        const response = await request(app)
            .get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('ok', true);
        expect(response.body).toHaveProperty('timestamp');
    });
});
