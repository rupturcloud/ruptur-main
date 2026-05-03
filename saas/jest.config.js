export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['.claude/worktrees', 'node_modules'],
  collectCoverageFrom: ['modules/**/*.js'],
  transform: {},
};
