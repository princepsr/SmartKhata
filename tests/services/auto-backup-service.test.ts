import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import fs from 'fs';
import path from 'path';

// MUST be prefixed with 'mock' to be used in vi.mock
const { mockSettingsInstance, mockAutoBackupLogger } = vi.hoisted(() => {
  return {
    mockSettingsInstance: {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      onChange: vi.fn(),
    },
    mockAutoBackupLogger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('../../src/main/services/settings-service', () => ({
  SettingsService: {
    getInstance: () => mockSettingsInstance,
  },
}));

vi.mock('../../src/main/services/backup-service', () => ({
  backupService: {
    createBackup: vi.fn(),
    rotateBackups: vi.fn(),
  },
}));

vi.mock('../../src/main/services/google-drive-service', () => ({
  googleDriveService: {
    syncBackup: vi.fn().mockResolvedValue({ success: true, fileId: 'test-file' }),
  },
}));

vi.mock('../../src/main/services/google-auth-service', () => ({
  googleAuthService: {
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../src/main/services/connectivity-service', () => ({
  connectivityService: {
    start: vi.fn(),
    stop: vi.fn(),
    getIsOnline: vi.fn().mockReturnValue(true),
    on: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => './test-data/userData',
    isReady: () => true,
    once: vi.fn(),
  },
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    forModule: () => mockAutoBackupLogger,
  },
}));

import { AutoBackupService } from '../../src/main/services/auto-backup-service';
import { backupService } from '../../src/main/services/backup-service';
import { googleDriveService } from '../../src/main/services/google-drive-service';
import { googleAuthService } from '../../src/main/services/google-auth-service';

interface AutoBackupServiceWithPrivates extends AutoBackupService {
  instance: AutoBackupService | undefined;
  checkAndPerformBackup: () => Promise<void>;
}

describe('AutoBackupService', () => {
  let service: AutoBackupService;
  let servicePriv: AutoBackupServiceWithPrivates;
  const testUserData = './test-data/userData';
  const backupDir = path.join(testUserData, 'autobackups');

  beforeEach(() => {
    vi.clearAllMocks();

    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    // Default config
    mockSettingsInstance.getConfig.mockReturnValue({
      autoBackupEnabled: true,
      autoBackupIntervalDays: 1,
      autoBackupIntervalUnit: 'days',
      autoBackupRetainCount: 3,
      lastAutoBackup: null,
    });

    // Mock createBackup to create file
    const createBackupMock = backupService.createBackup as Mock<[string], Promise<string>>;
    createBackupMock.mockImplementation(async (dir: string) => {
      const filePath = path.join(dir, 'test-backup.zip');
      fs.writeFileSync(filePath, 'data');
      return filePath;
    });

    (AutoBackupService as unknown as AutoBackupServiceWithPrivates).instance = undefined;
    service = AutoBackupService.getInstance();
    servicePriv = service as unknown as AutoBackupServiceWithPrivates;
  });

  afterEach(() => {
    service.stop();
    vi.restoreAllMocks();
  });

  it('should backup if interval is reached (days)', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    mockSettingsInstance.getConfig.mockReturnValue({
      autoBackupEnabled: true,
      autoBackupIntervalDays: 1,
      autoBackupIntervalUnit: 'days',
      lastAutoBackup: twoDaysAgo.toISOString(),
    });

    await servicePriv.checkAndPerformBackup();
    expect(backupService.createBackup).toHaveBeenCalled();
  });

  it('should backup if interval is reached (hours)', async () => {
    const threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

    mockSettingsInstance.getConfig.mockReturnValue({
      autoBackupEnabled: true,
      autoBackupIntervalDays: 1,
      autoBackupIntervalUnit: 'hours',
      lastAutoBackup: threeHoursAgo.toISOString(),
    });

    await servicePriv.checkAndPerformBackup();
    expect(backupService.createBackup).toHaveBeenCalled();
  });

  it('should trigger cloud sync after backup if enabled', async () => {
    mockSettingsInstance.getConfig.mockReturnValue({
      autoBackupEnabled: true,
      googleDriveSyncEnabled: true,
      lastAutoBackup: null,
    });

    const isAuthMock = googleAuthService.isAuthenticated as Mock<[], boolean>;
    isAuthMock.mockReturnValue(true);

    await servicePriv.checkAndPerformBackup();
    expect(googleDriveService.syncBackup).toHaveBeenCalled();
  });

  it('should not backup if interval not yet reached', async () => {
    const justNow = new Date().toISOString();
    mockSettingsInstance.getConfig.mockReturnValue({
      autoBackupEnabled: true,
      autoBackupIntervalDays: 1,
      autoBackupIntervalUnit: 'days',
      lastAutoBackup: justNow,
    });

    await servicePriv.checkAndPerformBackup();
    expect(backupService.createBackup).not.toHaveBeenCalled();
  });

  it('should trigger backup check when settings change', async () => {
    // The start method registers the listener AND immediately calls checkAndPerformBackup()
    service.start();

    expect(mockSettingsInstance.onChange).toHaveBeenCalled();

    // Wait for the initial checkAndPerformBackup() (fire-and-forget in start()) to settle
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate settings change
    const onMock = mockSettingsInstance.onChange as Mock;
    const [callback] = onMock.mock.calls[0];

    // Reset createBackup call count (may have been called by the initial check in start())
    const createBackupMock = backupService.createBackup as Mock;
    createBackupMock.mockClear();

    // Set up mock to trigger backup
    mockSettingsInstance.getConfig.mockReturnValue({
      autoBackupEnabled: true,
      lastAutoBackup: null,
    });

    // To trigger checkAndPerformBackup, the newConfig must DIFFER from what start() saw
    const newConfig = {
      autoBackupEnabled: true,
      autoBackupIntervalDays: 2, // Different from initial (1) to trigger intervalChanged
      autoBackupIntervalUnit: 'days',
      autoBackupRetainCount: 3,
      lastAutoBackup: null, // null means backup WILL trigger
    };
    await callback(newConfig);

    expect(backupService.createBackup).toHaveBeenCalled();
  });
});
