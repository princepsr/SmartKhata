import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsRepository } from '../../src/main/repositories/settings-repository';
import { databaseManager } from '../../src/main/database';
import { createTestDatabase, seedTestData } from '../utils/test-db';

describe('SettingsRepository Persistence', () => {
  let repository: SettingsRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await createTestDatabase();
    seedTestData(db);

    // Custom mock for databaseManager to return the real test DB
    // We cast to unknown then to specific mock return type to avoid 'any'
    vi.mocked(databaseManager.getDatabase).mockReturnValue(db as unknown as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    repository = new SettingsRepository();
  });

  it('should persist and retrieve autoUpdateEnabled setting', () => {
    // 1. Initial state (default should be true)
    const initialConfig = repository.getConfig();
    expect(initialConfig.autoUpdateEnabled).toBe(true);

    // 2. Update to false
    repository.updateConfig({ autoUpdateEnabled: false });

    const updatedConfig = repository.getConfig();
    expect(updatedConfig.autoUpdateEnabled).toBe(false);

    // 3. Update back to true
    repository.updateConfig({ autoUpdateEnabled: true });

    const finalConfig = repository.getConfig();
    expect(finalConfig.autoUpdateEnabled).toBe(true);
  });

  it('should maintain autoUpdateEnabled across partial updates', () => {
    repository.updateConfig({ autoUpdateEnabled: false });

    // Partial update of another field
    repository.updateConfig({ shopName: 'Updated Name' });

    const config = repository.getConfig();
    expect(config.shopName).toBe('Updated Name');
    expect(config.autoUpdateEnabled).toBe(false); // Should remain false
  });
});
