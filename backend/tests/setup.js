/**
 * Jest Global Setup
 * Configures mocks and test utilities for all tests
 */

// Mock the database pool by default
jest.mock('../db', () => {
    const mockClient = {
        query: jest.fn(),
        release: jest.fn()
    };

    return {
        query: jest.fn(),
        connect: jest.fn().mockResolvedValue(mockClient),
        end: jest.fn()
    };
});

// Mock console.error to keep tests clean (optional)
// Uncomment if you want to suppress console.error during tests
// global.console.error = jest.fn();

// Global test utilities
global.testUtils = {
    /**
     * Creates a mock database client for transaction testing
     */
    createMockClient: () => ({
        query: jest.fn(),
        release: jest.fn()
    }),

    /**
     * Creates a mock request object
     */
    createMockRequest: (overrides = {}) => ({
        user: {
            id: 1,
            tenant_id: 1,
            id_sucursal: 1,
            ...overrides.user
        },
        body: overrides.body || {},
        params: overrides.params || {},
        query: overrides.query || {}
    }),

    /**
     * Creates a mock response object
     */
    createMockResponse: () => {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        res.send = jest.fn().mockReturnValue(res);
        return res;
    },

    /**
     * Resets all mocks in the provided module
     */
    resetModuleMocks: (modulePath) => {
        jest.resetModules();
        return require(modulePath);
    }
};

// Extend expect with custom matchers
expect.extend({
    /**
     * Custom matcher to check if an error was thrown with specific status
     */
    toThrowWithStatus(received, expectedStatus) {
        const pass = received && received.status === expectedStatus;
        return {
            pass,
            message: () => pass
                ? `expected error not to have status ${expectedStatus}`
                : `expected error to have status ${expectedStatus}, but got ${received?.status}`
        };
    },

    /**
     * Custom matcher to check if a number is a valid currency amount
     */
    toBeValidCurrency(received) {
        const pass = typeof received === 'number' &&
            !isNaN(received) &&
            isFinite(received) &&
            received >= 0;
        return {
            pass,
            message: () => pass
                ? `expected ${received} not to be a valid currency amount`
                : `expected ${received} to be a valid currency amount (non-negative number)`
        };
    }
});

// Cleanup after all tests
afterAll(async () => {
    // Close any open handles
    jest.clearAllMocks();
});

// Log test suite info
beforeAll(() => {
    console.log('\n🧪 Versa-App Backend Test Suite\n');
});
