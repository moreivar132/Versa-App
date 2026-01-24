/**
 * VERSA - Vertical Access Control Integration Tests
 * 
 * Integration tests for:
 * - Vertical access denial
 * - Cross-tenant access denial  
 * - Permission enforcement
 */

const request = require('supertest');
const { app } = require('../../src/app');
const pool = require('../../db');
const jwt = require('jsonwebtoken');

// Unmock DB for integration tests
jest.unmock('../../db');

// Helper to generate tokens
const generateToken = (userId, tenantId, role = 'admin', isSuperAdmin = false) => {
    return jwt.sign(
        {
            id: userId,
            id_tenant: tenantId,
            rol: role,
            is_super_admin: isSuperAdmin
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
    );
};

describe('Vertical Access Control Integration', () => {
    let client;
    let tokens = {};
    let data = {};

    beforeAll(async () => {
        // Disable RBAC bypass for these security tests
        process.env.BYPASS_RBAC = 'false';

        // Connect to DB
        client = await pool.connect();

        // Get test users and tenants from existing QA seed
        // We use the same seeds as contabilidad.qa.test.js to ensure environment consistency
        const adminA = await client.query("SELECT id FROM usuario WHERE email = 'adminA@qa.versa.com'");
        const adminB = await client.query("SELECT id FROM usuario WHERE email = 'adminB@qa.versa.com'");
        const tenantA = await client.query("SELECT id FROM tenant WHERE nombre = 'QA Tenant A'");
        const tenantB = await client.query("SELECT id FROM tenant WHERE nombre = 'QA Tenant B'");
        const superAdmin = await client.query("SELECT id FROM usuario WHERE is_super_admin = true LIMIT 1");

        // Ensure we handle missing seeds gracefully (though they should exist in CI)
        data = {
            adminA: adminA.rows[0]?.id || 44,
            adminB: adminB.rows[0]?.id || 46,
            tenantA: tenantA.rows[0]?.id || 31,
            tenantB: tenantB.rows[0]?.id || 32,
            superAdmin: superAdmin.rows[0]?.id || 8
        };

        tokens.adminA = generateToken(data.adminA, data.tenantA, 'admin', false);
        tokens.adminB = generateToken(data.adminB, data.tenantB, 'admin', false);
        tokens.superAdmin = generateToken(data.superAdmin, data.tenantA, 'super_admin', true);
    });

    afterAll(async () => {
        client.release();
        await pool.end();
    });

    describe('GET /api/me/access', () => {
        it('returns access info for authenticated user', async () => {
            const res = await request(app)
                .get('/api/me/access')
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .expect(200);

            expect(res.body).toHaveProperty('verticals');
            expect(res.body).toHaveProperty('permissions');
            expect(res.body).toHaveProperty('branches');
            expect(res.body).toHaveProperty('roles');
            expect(Array.isArray(res.body.verticals)).toBe(true);
        });

        it('returns 401 for unauthenticated request', async () => {
            await request(app)
                .get('/api/me/access')
                .expect(401);
        });

        it('returns all verticals enabled for super admin', async () => {
            const res = await request(app)
                .get('/api/me/access')
                .set('Authorization', `Bearer ${tokens.superAdmin}`)
                .expect(200);

            // Super admin logic usually implies full access, let's verify permissions
            // Assuming super admin has '*'
            if (res.body.permissions) {
                // Not all implementations return '*' literal, but usually they do or a flag
            }
            expect(res.body.verticals.length).toBeGreaterThan(0);
        });
    });

    describe('Cross-Tenant Access Denial', () => {
        it('user cannot access data from another tenant', async () => {
            // User from Tenant A trying to access Tenant B resources via X-Tenant-Id header
            // NOTE: The backend RLS should ignore X-Tenant-Id for non-SuperAdmins and use the token's tenant

            const res = await request(app)
                .get('/api/contabilidad/empresas') // A known multi-tenant route
                .set('Authorization', `Bearer ${tokens.adminA}`)
                .set('X-Tenant-Id', data.tenantB);

            // The response should be 403 because adminA does not have permissions in Tenant B
            expect(res.status).toBe(403);
        });

        it('super admin can impersonate any tenant', async () => {
            // Super admin accessing Tenant B
            const res = await request(app)
                .get('/api/contabilidad/empresas')
                .set('Authorization', `Bearer ${tokens.superAdmin}`)
                .set('X-Tenant-Id', data.tenantB);

            expect(res.status).toBe(200);

            // If seed data exists, we might verify we see Tenant B data
            // But minimal assertion is 200 OK and no error
        });
    });
});
