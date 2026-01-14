const baseConfig = require('./jest.config');

module.exports = {
    ...baseConfig,
    setupFilesAfterEnv: [], // Disable global setup (which mocks DB)
};
