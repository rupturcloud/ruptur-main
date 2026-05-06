export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['node_modules', '<rootDir>/.claude', '<rootDir>/dist-client', '<rootDir>/web/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude', '<rootDir>/dist-client', '<rootDir>/web/'],
  collectCoverageFrom: [
    'api/**/*.mjs',
    'modules/**/*.js',
    'modules/**/*.mjs',
    'integrations/**/*.js',
    '!modules/warmup-core/server.mjs',
    '!**/node_modules/**',
    '!**/dist-client/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  transform: {},
};
