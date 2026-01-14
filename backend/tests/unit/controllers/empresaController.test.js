/**
 * Unit Tests: Empresa Controller
 */

const empresaController = require('../../../src/modules/contable/api/controllers/empresa.controller');
const pool = require('../../../db');
const { getEffectiveTenant } = require('../../../middleware/rbac');

// Mocks
jest.mock('../../../db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

jest.mock('../../../middleware/rbac', () => ({
    getEffectiveTenant: jest.fn()
}));

describe('Empresa Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            user: { id: 1, rol: 'user' },
            params: {},
            body: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        getEffectiveTenant.mockReturnValue(1); // Default tenant 1
    });

    // =======================================================================
    // CREATE
    // =======================================================================
    describe('create', () => {
        test('debería crear una empresa correctamente', async () => {
            req.body = {
                nombre_legal: 'Mi Empresa SL',
                nif_cif: 'B12345678'
            };

            const mockClient = {
                query: jest.fn(),
                release: jest.fn()
            };
            pool.connect.mockResolvedValue(mockClient);

            // Mock queries: 
            // 1. BEGIN
            // 2. Check Count
            // 3. Insert Empresa
            // 4. Insert Cuenta
            // 5. Insert Usuario
            // 6. COMMIT
            mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Check default
                .mockResolvedValueOnce({ rows: [{ id: 1, nombre_legal: 'Mi Empresa SL', es_default: true }] }) // Insert Empresa
                .mockResolvedValueOnce({}) // Insert Cuenta
                .mockResolvedValueOnce({}) // Insert Usuario
                .mockResolvedValueOnce({}); // COMMIT

            await empresaController.create(req, res);

            expect(pool.connect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledTimes(6); // BEGIN, Check, Create Empresa, Create Cuenta, Create User Assoc, COMMIT

            // Checking response
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                ok: true,
                data: expect.objectContaining({ nombre_legal: 'Mi Empresa SL' })
            }));
        });

        test('debería fallar si faltan datos obligatorios', async () => {
            req.body = {}; // Missing name/nif

            await empresaController.create(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
        });
    });

    // =======================================================================
    // LIST
    // =======================================================================
    describe('list', () => {
        test('debería listar empresas para admin', async () => {
            req.user.rol = 'admin';
            pool.query.mockResolvedValue({
                rows: [{ id: 1, nombre_legal: 'Empresa 1' }, { id: 2, nombre_legal: 'Empresa 2' }]
            });

            await empresaController.list(req, res);

            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT e.*'), [1]);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                data: expect.arrayContaining([{ id: 1, nombre_legal: 'Empresa 1' }])
            });
        });

        test('debería listar solo asignadas para usuario normal', async () => {
            req.user.rol = 'user';
            pool.query.mockResolvedValue({
                rows: [{ id: 1, nombre_legal: 'Empresa Asignada' }]
            });

            await empresaController.list(req, res);

            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('JOIN accounting_usuario_empresa'), [1, 1]);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                data: expect.arrayContaining([{ id: 1, nombre_legal: 'Empresa Asignada' }])
            });
        });
    });

    // =======================================================================
    // UPDATE
    // =======================================================================
    describe('update', () => {
        test('debería actualizar una empresa existente', async () => {
            req.params.id = 1;
            req.body = { nombre_legal: 'Nuevo Nombre' };

            // Check existence
            pool.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Exists check
                .mockResolvedValueOnce({ rows: [{ id: 1, nombre_legal: 'Nuevo Nombre' }] }); // Update returning

            await empresaController.update(req, res);

            expect(pool.query).toHaveBeenCalledTimes(2);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                data: expect.objectContaining({ nombre_legal: 'Nuevo Nombre' }),
                message: expect.any(String)
            });
        });

        test('debería devolver 404 si empresa no existe', async () => {
            req.params.id = 999;
            req.body = { nombre_legal: 'Nuevo Nombre' };

            pool.query.mockResolvedValueOnce({ rows: [] }); // Not found

            await empresaController.update(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
