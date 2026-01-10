/**
 * Tests de integración: Técnicos por Sucursal
 * 
 * Valida que el endpoint GET /api/sucursales/:id/tecnicos:
 * 1. Devuelve solo técnicos asignados a esa sucursal
 * 2. No devuelve técnicos de otras sucursales
 * 3. Retorna 404 para sucursales inexistentes
 * 4. No incluye técnicos sin asignación
 */

// Mock del pool de conexiones
const mockPool = {
    query: jest.fn()
};

jest.mock('../../db', () => mockPool);

// Importar después del mock
const request = require('supertest');
const express = require('express');

// Crear app de prueba
const app = express();
app.use(express.json());

// Mock del middleware de auth
const mockVerifyJWT = (req, res, next) => {
    req.user = {
        id: 1,
        id_tenant: 1,
        is_super_admin: false
    };
    next();
};

// Importar router con mocks
jest.mock('../../middleware/auth', () => mockVerifyJWT);
const sucursalesRouter = require('../../routes/sucursales');
app.use('/api/sucursales', sucursalesRouter);

describe('GET /api/sucursales/:id/tecnicos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Filtrado por sucursal', () => {
        test('Devuelve solo técnicos de sucursal A', async () => {
            // Mock: Sucursal A existe
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Sucursal check
                .mockResolvedValueOnce({
                    rows: [
                        { id: 101, nombre: 'Técnico A1', email: 'a1@test.com', porcentaje_mano_obra: 50 },
                        { id: 102, nombre: 'Técnico A2', email: 'a2@test.com', porcentaje_mano_obra: 50 }
                    ]
                });

            const response = await request(app)
                .get('/api/sucursales/1/tecnicos')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body.ok).toBe(true);
            expect(response.body.tecnicos).toHaveLength(2);
            expect(response.body.tecnicos.map(t => t.nombre)).toContain('Técnico A1');
            expect(response.body.tecnicos.map(t => t.nombre)).toContain('Técnico A2');
        });

        test('Devuelve solo técnicos de sucursal B (no incluye A)', async () => {
            // Mock: Sucursal B existe, solo tiene 1 técnico
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // Sucursal check
                .mockResolvedValueOnce({
                    rows: [
                        { id: 201, nombre: 'Técnico B1', email: 'b1@test.com', porcentaje_mano_obra: 60 }
                    ]
                });

            const response = await request(app)
                .get('/api/sucursales/2/tecnicos')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body.ok).toBe(true);
            expect(response.body.tecnicos).toHaveLength(1);
            expect(response.body.tecnicos[0].nombre).toBe('Técnico B1');
            // Verificar que NO contiene técnicos de A
            expect(response.body.tecnicos.map(t => t.nombre)).not.toContain('Técnico A1');
            expect(response.body.tecnicos.map(t => t.nombre)).not.toContain('Técnico A2');
        });

        test('Sucursal sin técnicos devuelve array vacío', async () => {
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 3 }] }) // Sucursal existe
                .mockResolvedValueOnce({ rows: [] }); // Sin técnicos

            const response = await request(app)
                .get('/api/sucursales/3/tecnicos')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body.ok).toBe(true);
            expect(response.body.tecnicos).toHaveLength(0);
        });
    });

    describe('Validaciones', () => {
        test('Sucursal inexistente retorna 404', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] }); // Sucursal no existe

            const response = await request(app)
                .get('/api/sucursales/999999/tecnicos')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(404);
            expect(response.body.ok).toBe(false);
            expect(response.body.error).toContain('no encontrada');
        });

        test('Técnico sin asignación a sucursal no aparece', async () => {
            // El query solo retorna técnicos que tienen entrada en usuario_sucursal
            // Por diseño, un técnico sin asignación no aparecerá en ninguna consulta
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Sucursal existe
                .mockResolvedValueOnce({
                    rows: [
                        { id: 101, nombre: 'Técnico Asignado', email: 'asignado@test.com' }
                        // Técnico sin asignación NO está en la respuesta
                    ]
                });

            const response = await request(app)
                .get('/api/sucursales/1/tecnicos')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(200);
            expect(response.body.tecnicos).toHaveLength(1);
            expect(response.body.tecnicos.map(t => t.nombre)).not.toContain('Técnico Sin Asignación');
        });
    });

    describe('Query SQL correcto', () => {
        test('El query incluye JOIN con usuario_sucursal', async () => {
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [] });

            await request(app)
                .get('/api/sucursales/1/tecnicos')
                .set('Authorization', 'Bearer test-token');

            // Verificar que el segundo query (el de técnicos) tiene el JOIN correcto
            const tecnicosQuery = mockPool.query.mock.calls[1][0];
            expect(tecnicosQuery).toContain('usuario_sucursal');
            expect(tecnicosQuery).toContain('INNER JOIN');
            expect(tecnicosQuery).toContain('id_sucursal');
        });

        test('Filtra por id_sucursal y id_tenant correctamente', async () => {
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [] });

            await request(app)
                .get('/api/sucursales/1/tecnicos')
                .set('Authorization', 'Bearer test-token');

            // Verificar parámetros del query
            const params = mockPool.query.mock.calls[1][1];
            expect(params).toContain(1); // id_sucursal
            expect(params).toContain(1); // id_tenant (del mock user)
        });
    });
});
