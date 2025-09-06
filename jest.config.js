module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/__tests__/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: process.env.CI ? 30000 : 10000, // 30s timeout in CI
  maxWorkers: process.env.CI ? 2 : '50%', // Limit workers in CI
  detectOpenHandles: true // Keep this on to find leaks
};
