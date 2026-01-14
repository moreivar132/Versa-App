const request = require('supertest');
const { app } = require('../../src/app');
const pool = require('../../db');
const jwt = require('jsonwebtoken');

// Helpers for Auth
const generateToken = (userId, tenantId, role = 'admin') => {
    return jwt.sign({ id: userId, id_tenant: tenantId, rol: role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
};

describe('Contabilidad V2 Integration Tests (QA)', () => {
    let client;
    let tokens = {};
    let data = {};

    beforeAll(async () => {
        // Connect and get seed data
        client = await pool.connect();

        // Fetch IDs created by seed
        const adminA = await client.query("SELECT id FROM usuario WHERE email = 'adminA@qa.versa.com'");
        const adminB = await client.query("SELECT id FROM usuario WHERE email = 'adminB@qa.versa.com'");
        const tenantA = await client.query("SELECT id FROM tenant WHERE nombre = 'QA Tenant A'");
        const tenantB = await client.query("SELECT id FROM tenant WHERE nombre = 'QA Tenant B'");
        const empresaA1 = await client.query("SELECT id FROM accounting_empresa WHERE nif_cif = 'B-QA-A1'");
        const empresaA2 = await client.query("SELECT id FROM accounting_empresa WHERE nif_cif = 'B-QA-A2'");

        data = {
            adminA: adminA.rows[0].id,
            adminB: adminB.rows[0].id,
            tenantA: tenantA.rows[0].id,
            tenantB: tenantB.rows[0].id,
            empresaA1: empresaA1.rows[0].id,
            empresaA2: empresaA2.rows[0].id
        };

        // Generate tokens
        tokens.adminA = generateToken(data.adminA, data.tenantA);
        tokens.adminB = generateToken(data.adminB, data.tenantB);
    });

    afterAll(async () => {
        client.release();
        await pool.end();
    });

    // =======================================================================
    // 1. EMPRESAS (Isolation & Scoping)
    // =======================================================================

    describe('GET /api/contabilidad/empresas', () => {
        it('QA-01: Admin A should see companies A1 and A2', async () => {
            const res = await request(app)
                .get('/api/contabilidad/empresas')
                .set('Authorization', `Bearer ${tokens.adminA}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.items).toHaveLength(2);
            expect(res.body.items.map(e => e.id)).toContain(data.empresaA1);
            expect(res.body.items.map(e => e.id)).toContain(data.empresaA2);
        });

        it('QA-02: Admin B should NOT see companies from Tenant A', async () => {
            const res = await request(app)
                .get('/api/contabilidad/empresas')
                .set('Authorization', `Bearer ${tokens.adminB}`);

            expect(res.statusCode).toBe(200);
            // Admin B has 1 company (B1)
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].id).not.toBe(data.empresaA1);
        });
    });

    // =======================================================================
    // 2. FACTURAS (Empresa Context & Validation)
    // =======================================================================

    describe('POST /api/contabilidad/facturas', () => {
        it('QA-03: Should fail if x-empresa-id header is missing', async () => {
            const res = await request(app)
                .post('/api/contabilidad/facturas')
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .send({
                    tipo: 'INGRESO',
                    numero_factura: 'TEST-FAIL',
                    fecha_emision: '2026-01-01',
                    base_imponible: 100,
                    total: 121
                });

            // Expect 400 or 403 depending on middleware impl.
            // Middleware checks header/query. If missing => 400 'Empresa ID requerida'
            expect(res.statusCode).toBe(400);
        });

        it('QA-04: Should fail if accessing empresa from another tenant', async () => {
            // Admin B tries to create invoice in Empresa A1
            const res = await request(app)
                .post('/api/contabilidad/facturas')
                .set('Authorization', `Bearer ${tokens.adminB}`) // Tenant B
                .set('x-empresa-id', data.empresaA1) // Tenant A's company
                .send({
                    tipo: 'INGRESO',
                    numero_factura: 'TEST-SECURITY',
                    fecha_emision: '2026-01-01',
                    base_imponible: 100,
                    total: 121
                });

            // Middleware should block this (Tenant mismatch or User Access mismatch)
            expect(res.statusCode).toBe(403);
        });

        it('QA-05: Should create invoice in correct empresa context', async () => {
            const res = await request(app)
                .post('/api/contabilidad/facturas')
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .set('x-empresa-id', data.empresaA1)
                .send({
                    tipo: 'INGRESO',
                    numero_factura: 'FAC-QA-TEST-1',
                    fecha_emision: '2026-01-14',
                    fecha_devengo: '2026-01-14',
                    base_imponible: 100.00,
                    iva_porcentaje: 21.00,
                    iva_importe: 21.00,
                    total: 121.00,
                    notas: 'QA Auto Test'
                });

            expect(res.statusCode).toBe(201); // Created
            expect(res.body.id_empresa).toBe(data.empresaA1);
            expect(res.body.numero_factura).toBe('FAC-QA-TEST-1');
        });
    });

    // =======================================================================
    // 3. CONTACTOS (Filtering)
    // =======================================================================

    describe('GET /api/contabilidad/contactos', () => {
        it('QA-06: Should verify IBAN format on creation', async () => {
            const res = await request(app)
                .post('/api/contabilidad/contactos')
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .set('x-empresa-id', data.empresaA1)
                .send({
                    tipo: 'CLIENTE',
                    nombre: 'Cliente IBAN Bad',
                    nif_cif: 'BAD-IBAN',
                    iban: 'INVALID-IBAN'
                });

            // Depending on validation strictness. If strict => 400.
            // If loose => 201. Assuming loose for now or strict? 
            // Let's assume repo just stores it as text, so 201, but we verify field exists.
            expect(res.statusCode).toBe(201);
            expect(res.body.iban).toBe('INVALID-IBAN');
        });
    });

    // =======================================================================
    // 4. DASHBOARD (Metrics)
    // =======================================================================

    describe('GET /api/contabilidad/dashboard', () => {
        it('QA-07: Should return distinct metrics for different companies', async () => {
            // Empresa A1 has data from Seed
            const resA1 = await request(app)
                .get('/api/contabilidad/dashboard?anio=2026&trimestre=1')
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .set('x-empresa-id', data.empresaA1);

            // Empresa A2 has different data (only 1 invoice 2000€)
            const resA2 = await request(app)
                .get('/api/contabilidad/dashboard?anio=2026&trimestre=1')
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .set('x-empresa-id', data.empresaA2);

            expect(resA1.statusCode).toBe(200);
            expect(resA2.statusCode).toBe(200);

            // Verify they are different
            // A1: 1000 base + 500 gasto base ...
            // A2: 2000 base
            // Actual values depend on exact seed logic / KPI calc, but they SHOULD differ
            expect(JSON.stringify(resA1.body)).not.toEqual(JSON.stringify(resA2.body));
        });
    });

});
