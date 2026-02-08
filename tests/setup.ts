/**
 * Test Setup
 * 
 * Global setup for all tests.
 */

import { beforeAll, afterAll } from 'vitest';
import { closeTestDatabase } from './utils/test-db';

// Global setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

// Global teardown
afterAll(() => {
  // Close test database
  closeTestDatabase();
});
