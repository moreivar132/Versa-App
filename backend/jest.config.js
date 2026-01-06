/**
 * Jest Configuration for Versa-App Backend
 * TDD Implementation - Professional Testing Setup
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Root directory for tests
    roots: ['<rootDir>/tests'],

    // Test file patterns
    testMatch: [
        '**/*.test.js',
        '**/*.spec.js'
    ],

    // Setup files to run before each test file
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Module directories
    moduleDirectories: ['node_modules', '<rootDir>'],

    // Coverage configuration
    collectCoverageFrom: [
        'services/**/*.js',
        'repositories/**/*.js',
        'routes/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**'
    ],

    // Coverage thresholds - global only for now
    // Specific file thresholds can be added as coverage improves
    coverageThreshold: {
        global: {
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        }
    },

    // Coverage output directory
    coverageDirectory: 'coverage',

    // Coverage reporters
    coverageReporters: ['text', 'text-summary', 'html', 'lcov'],

    // Verbose output
    verbose: true,

    // Test timeout (30 seconds for integration tests)
    testTimeout: 30000,

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks after each test
    restoreMocks: true,

    // Force exit after tests complete
    forceExit: true,

    // Display individual test results
    reporters: ['default'],

    // Module name mapping for cleaner imports
    moduleNameMapper: {
        '^@services/(.*)$': '<rootDir>/services/$1',
        '^@repositories/(.*)$': '<rootDir>/repositories/$1',
        '^@routes/(.*)$': '<rootDir>/routes/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1'
    }
};
