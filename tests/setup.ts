/**
 * Global test setup
 *
 * Runs before all test suites to configure the test environment
 */

import { vi, beforeAll } from 'vitest';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

console.error('DEBUG: Vitest Node Version:', process.version);
console.error('DEBUG: Vitest Modules Version:', process.versions.modules);

import { createTestDatabase, getTestDatabase } from './utils/test-db';

// Global environment variables for testing
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

// Mock Electron's app object
vi.mock('electron', () => {
  const testDataPath = path.join(process.cwd(), 'test-data');
  return {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'temp') {
          return path.join(testDataPath, 'temp');
        }
        return testDataPath;
      }),
      getVersion: vi.fn(() => '0.1.0-test'),
    },
    dialog: {
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn(),
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => []),
      getFocusedWindow: vi.fn(),
      fromId: vi.fn(),
    },
  };
});

// Mock database manager to use test database
const databaseMock = {
  initialize: vi.fn(),
  close: vi.fn(),
  createTestDatabase: async () => {
    const db = new Database(':memory:');
    return db;
  },
  getDatabase: vi.fn(() => {
    try {
      return getTestDatabase();
    } catch {
      return {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 }),
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
        }),
        backup: vi.fn().mockResolvedValue(undefined),
        exec: vi.fn(),
        close: vi.fn(),
      };
    }
  }),
  transaction: (() => {
    let depth = 0;
    return vi.fn((fn: () => unknown) => {
      const db = databaseMock.getDatabase();
      if (!db || typeof db.exec !== 'function') {
        return fn();
      }

      depth++;
      try {
        if (depth === 1) {
          db.exec('BEGIN TRANSACTION');
        }
        const result = fn();
        if (depth === 1) {
          db.exec('COMMIT');
        }
        return result;
      } catch (error) {
        if (depth === 1) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* ignore */
          }
        }
        throw error;
      } finally {
        depth--;
      }
    });
  })(),
  isReady: vi.fn(() => true),
  getDatabasePath: vi.fn(() => './test-data/active.sqlite'),
};

// Target the canonical path for databaseManager
vi.mock('@main/database', () => ({ databaseManager: databaseMock }));
vi.mock('../src/main/database/index.ts', () => ({ databaseManager: databaseMock }));

// Mock migration runner
vi.mock('@main/database/migrations', () => ({
  migrationRunner: {
    getCurrentVersion: vi.fn().mockReturnValue(1),
    runPendingMigrations: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger to avoid file system operations in tests
const mockLoggerInstance = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  forModule: vi.fn().mockReturnThis(),
  getLogsDirectory: vi.fn().mockReturnValue('./test-data/logs'),
};

vi.mock('@main/utils/logger', () => ({
  logger: mockLoggerInstance,
  Logger: vi.fn().mockImplementation(() => mockLoggerInstance),
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
}));

vi.mock('../src/main/utils/logger', () => ({
  logger: mockLoggerInstance,
  Logger: vi.fn().mockImplementation(() => mockLoggerInstance),
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },
}));

// Global setup
beforeAll(async () => {
  // Initialize test database
  await createTestDatabase();
});
