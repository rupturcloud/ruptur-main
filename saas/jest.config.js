export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['node_modules', '<rootDir>/.claude', '<rootDir>/dist-client', '<rootDir>/web/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude', '<rootDir>/dist-client', '<rootDir>/web/'],
  collectCoverageFrom: ['modules/**/*.js'],
  transform: {},
};
