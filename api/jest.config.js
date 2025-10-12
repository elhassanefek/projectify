module.exports = {
  // Timeout for tests
  testTimeout: 30000,

  // Coverage settings
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.js", "!src/server.js", "!**/node_modules/**"],

  // Test match patterns
  testMatch: ["**/tests/**/*.test.js", "**/__tests__/**/*.js"],

  // Setup files
  // setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,
  setupFiles: ["<rootDir>/tests/setup/testEnvSetup.js"],
  // Run tests serially
  maxWorkers: 1,
};
