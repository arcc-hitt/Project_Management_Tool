// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'project_management_tool_test';
process.env.JWT_SECRET = 'test-secret-key';

// Import jest globals explicitly for ESM environment
import { jest } from '@jest/globals';
import database from '../src/config/database.js';
import { runMigrations } from '../src/scripts/migrate.js';

// Global test setup
beforeAll(async () => {
  // Ensure test database exists by running base migrations against the configured DB
  try {
    await runMigrations();
  } catch (e) {
    // If DB already exists, proceed
    // Any real errors will surface when running tests
  }
});

afterAll(async () => {
  // Close database connections
  try {
    await database.close();
  } catch (e) {
    // ignore
  }
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

// Global test utilities
global.testHelpers = {
  createMockUser: () => ({
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'developer',
    isActive: true,
  }),
  
  createMockProject: () => ({
    id: 1,
    name: 'Test Project',
    description: 'Test project description',
    status: 'active',
    priority: 'medium',
    createdBy: 1,
  }),
  
  createMockTask: () => ({
    id: 1,
    title: 'Test Task',
    description: 'Test task description',
    status: 'todo',
    priority: 'medium',
    projectId: 1,
    createdBy: 1,
  }),
};