/**
 * VERSA - Vertical Access Control Unit Tests
 * 
 * Tests for:
 * - requireVerticalAccess middleware
 * - Security context resolution
 * - Permission computation with overrides
 */

const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock dependencies
jest.mock('../../db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

jest.mock('../../src/core/logging/logger', () => ({
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn()
}));

const pool = require('../../db');

describe('requireVerticalAccess', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            user: { id: 1, id_tenant: 100 },
            path: '/api/v1/manager/workorders'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    describe('authentication checks', () => {
        it('returns 401 if no user in request', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');
            req.user = null;

            const middleware = requireVerticalAccess('manager');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'AUTH_REQUIRED'
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 400 if no tenant identified', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');
            req.user = { id: 1 }; // No tenant

            const middleware = requireVerticalAccess('manager');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'TENANT_REQUIRED'
            }));
        });
    });

    describe('super admin bypass', () => {
        it('allows super admin to access any vertical', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');

            // Mock super admin check
            pool.query.mockResolvedValueOnce({
                rows: [{ is_super_admin: true }]
            });

            const middleware = requireVerticalAccess('manager');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.isSuperAdmin).toBe(true);
            expect(req.verticalAccess.bypassed).toBe(true);
        });
    });

    describe('vertical access checks', () => {
        beforeEach(() => {
            // Not super admin
            pool.query.mockResolvedValueOnce({
                rows: [{ is_super_admin: false }]
            });
        });

        it('allows access when tenant has vertical enabled', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');

            // Mock vertical lookup
            pool.query.mockResolvedValueOnce({
                rows: [{ id: 1, key: 'manager', name: 'Manager', enabled: true }]
            });

            const middleware = requireVerticalAccess('manager');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.verticalKey).toBe('manager');
            expect(req.verticalAccess.enabled).toBe(true);
        });

        it('returns 403 when vertical not enabled for tenant', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');

            // Mock vertical lookup - not enabled
            pool.query.mockResolvedValueOnce({
                rows: [{ id: 2, key: 'saas', name: 'Contable', enabled: false }]
            });

            const middleware = requireVerticalAccess('saas');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'VERTICAL_NOT_ENABLED',
                upgrade: true
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 404 when vertical does not exist', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');

            // Mock vertical lookup - not found
            pool.query.mockResolvedValueOnce({
                rows: []
            });

            const middleware = requireVerticalAccess('nonexistent');
            await middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'VERTICAL_NOT_FOUND'
            }));
        });
    });

    describe('log-only mode', () => {
        it('allows request but logs would-be block in log-only mode', async () => {
            const { requireVerticalAccess } = require('../../src/core/security/requireVerticalAccess');

            // Not super admin
            pool.query.mockResolvedValueOnce({
                rows: [{ is_super_admin: false }]
            });

            // Vertical not enabled
            pool.query.mockResolvedValueOnce({
                rows: [{ id: 2, key: 'saas', name: 'Contable', enabled: false }]
            });

            const middleware = requireVerticalAccess('saas', { logOnly: true });
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.verticalAccess.wouldBlock).toBe(true);
            expect(res.status).not.toHaveBeenCalled();
        });
    });
});

describe('getUserAccessibleVerticals', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns all verticals for super admin', async () => {
        const { getUserAccessibleVerticals } = require('../../src/core/security/requireVerticalAccess');

        // Super admin check
        pool.query.mockResolvedValueOnce({
            rows: [{ is_super_admin: true }]
        });

        // All verticals
        pool.query.mockResolvedValueOnce({
            rows: [
                { id: 1, key: 'manager', name: 'Manager', enabled: true },
                { id: 2, key: 'saas', name: 'Contable', enabled: true },
                { id: 3, key: 'marketplace', name: 'Marketplace', enabled: true }
            ]
        });

        const verticals = await getUserAccessibleVerticals(1, 100);

        expect(verticals).toHaveLength(3);
        expect(verticals.every(v => v.enabled)).toBe(true);
    });

    it('returns only enabled verticals for regular user', async () => {
        const { getUserAccessibleVerticals } = require('../../src/core/security/requireVerticalAccess');

        // Not super admin
        pool.query.mockResolvedValueOnce({
            rows: [{ is_super_admin: false }]
        });

        // Tenant's verticals
        pool.query.mockResolvedValueOnce({
            rows: [
                { id: 1, key: 'manager', name: 'Manager', enabled: true },
                { id: 2, key: 'saas', name: 'Contable', enabled: false },
                { id: 3, key: 'marketplace', name: 'Marketplace', enabled: true }
            ]
        });

        const verticals = await getUserAccessibleVerticals(1, 100);

        expect(verticals).toHaveLength(3);
        expect(verticals.find(v => v.key === 'saas').enabled).toBe(false);
    });
});

describe('buildUserAccessInfo', () => {
    it('returns complete access info structure', async () => {
        const { buildUserAccessInfo } = require('../../src/core/security/context');

        // Mock all queries
        pool.query
            // getUserAccessibleVerticals - super admin check
            .mockResolvedValueOnce({ rows: [{ is_super_admin: false }] })
            // getUserAccessibleVerticals - verticals
            .mockResolvedValueOnce({
                rows: [{ id: 1, key: 'manager', name: 'Manager', enabled: true }]
            })
            // getUserPermissions - super admin check
            .mockResolvedValueOnce({ rows: [{ is_super_admin: false }] })
            // getUserPermissions - role permissions
            .mockResolvedValueOnce({
                rows: [{ permission_key: 'manager.workorders.view' }]
            })
            // getUserPermissions - overrides
            .mockResolvedValueOnce({ rows: [] })
            // getUserBranches
            .mockResolvedValueOnce({
                rows: [{ id: 1, nombre: 'Sucursal Centro' }]
            })
            // getUserRoles
            .mockResolvedValueOnce({
                rows: [{ id: 1, nombre: 'Mecánico', key: 'mecanico' }]
            });

        const accessInfo = await buildUserAccessInfo(1, 100);

        expect(accessInfo).toHaveProperty('verticals');
        expect(accessInfo).toHaveProperty('permissions');
        expect(accessInfo).toHaveProperty('branches');
        expect(accessInfo).toHaveProperty('roles');
    });
});
