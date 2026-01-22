/**
 * Unit Tests: Empresa Controller
 */

const empresaController = require('../../../src/modules/contable/api/controllers/empresa.controller');
const { getEffectiveTenant } = require('../../../middleware/rbac');

// Mock middlewares
jest.mock('../../../middleware/rbac', () => ({
    getEffectiveTenant: jest.fn(),
    isSuperAdmin: jest.fn().mockResolvedValue(false)
}));

describe('Empresa Controller', () => {
    let req, res, mockDb;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock DB interface
        mockDb = {
            query: jest.fn(),
            txWithRLS: jest.fn(async (callback) => {
                // Simulate transaction by just calling the callback with the same mockDb
                // In a real scenario, this might need a separate mockClient if we test isolation
                return await callback(mockDb);
            })
        };

        req = {
            user: { id: 1, rol: 'user' },
            params: {},
            body: {},
            db: mockDb // Inject mock DB
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

            // Mock queries for txWithRLS flow:
            // 1. Check Count (tx.query)
            // 2. Insert Empresa (tx.query)
            // 3. Insert Cuenta (tx.query)
            // 4. Insert Usuario (tx.query)
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // Check default
                .mockResolvedValueOnce({ rows: [{ id: 1, nombre_legal: 'Mi Empresa SL', es_default: true }] }) // Insert Empresa
                .mockResolvedValueOnce({}) // Insert Cuenta
                .mockResolvedValueOnce({}); // Insert Usuario

            await empresaController.create(req, res);

            expect(mockDb.txWithRLS).toHaveBeenCalled();
            expect(mockDb.query).toHaveBeenCalledTimes(4);

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
            mockDb.query.mockResolvedValue({
                rows: [{ id: 1, nombre_legal: 'Empresa 1' }, { id: 2, nombre_legal: 'Empresa 2' }]
            });

            await empresaController.list(req, res);

            expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('SELECT e.*'), [1]);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                data: expect.objectContaining({
                    items: expect.arrayContaining([{ id: 1, nombre_legal: 'Empresa 1' }])
                })
            });
        });

        test('debería listar solo asignadas para usuario normal', async () => {
            req.user.rol = 'user';
            mockDb.query.mockResolvedValue({
                rows: [{ id: 1, nombre_legal: 'Empresa Asignada' }]
            });

            await empresaController.list(req, res);

            expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('JOIN accounting_usuario_empresa'), [1, 1]);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                data: expect.objectContaining({
                    items: expect.arrayContaining([{ id: 1, nombre_legal: 'Empresa Asignada' }])
                })
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
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Exists check
                .mockResolvedValueOnce({ rows: [{ id: 1, nombre_legal: 'Nuevo Nombre' }] }); // Update returning

            await empresaController.update(req, res);

            expect(mockDb.query).toHaveBeenCalledTimes(2);
            expect(res.json).toHaveBeenCalledWith({
                ok: true,
                data: expect.objectContaining({ nombre_legal: 'Nuevo Nombre' }),
                message: expect.any(String)
            });
        });

        test('debería devolver 404 si empresa no existe', async () => {
            req.params.id = 999;
            req.body = { nombre_legal: 'Nuevo Nombre' };

            mockDb.query.mockResolvedValueOnce({ rows: [] }); // Not found

            await empresaController.update(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });
});
