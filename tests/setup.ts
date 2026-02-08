/**
 * Global test setup
 * 
 * Runs before all test suites to configure the test environment
 */

import { vi, beforeAll } from 'vitest';
import path from 'path';
import { createTestDatabase, getTestDatabase } from './utils/test-db';

// Mock Electron's app object
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      const testDataPath = path.join(process.cwd(), 'test-data');
      if (name === 'userData') return testDataPath;
      return testDataPath;
    },
    getVersion: () => '0.1.0-test',
  },
}));

// Mock database manager to use test database
vi.mock('../src/main/database/index.ts', () => {
  return {
    databaseManager: {
      getDatabase: () => {
        try {
          return getTestDatabase();
        } catch (e) {
          // Database not initialized yet, will be set up in beforeAll
          return null;
        }
      },
      transaction: (fn: () => any) => {
        // sql.js doesn't have native transaction support
        // For tests, execute the function (no actual transaction)
        return fn();
      },
      isReady: () => true,
      getDatabasePath: () => ':memory:',
    },
  };
});

// Mock logger to avoid file system operations in tests
vi.mock('../src/main/utils/logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Global setup
beforeAll(async () => {
  // Initialize test database
  await createTestDatabase();
});
