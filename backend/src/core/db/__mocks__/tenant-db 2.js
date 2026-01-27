/**
 * Mock automático para tenant-db
 * 
 * Usage in tests:
 * jest.mock('../../../src/core/db/tenant-db');
 * const { getTenantDb, _mockClient } = require('../../../src/core/db/tenant-db');
 * 
 * _mockClient.query.mockResolvedValue(...)
 */

const mockQuery = jest.fn();
const mockRelease = jest.fn();

const mockClient = {
    query: mockQuery,
    release: mockRelease,
    // Simulate transaction calls immediately
    txWithRLS: jest.fn(async (callback) => await callback(mockClient)),
    tx: jest.fn(async (callback) => await callback(mockClient))
};

const getTenantDb = jest.fn(() => mockClient);
const getSystemDb = jest.fn(() => mockClient);

module.exports = {
    getTenantDb,
    getSystemDb,
    _mockClient: mockClient,
    _mockQuery: mockQuery,
    _mockRelease: mockRelease
};
