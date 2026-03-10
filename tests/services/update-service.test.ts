import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { UpdateService } from '../../src/main/services/update-service';
import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import { SettingsService } from '../../src/main/services/settings-service';
import { backupService } from '../../src/main/services/backup-service';
import { UpdateStatus } from '../../src/shared/types/update';

// Mock electron-updater
vi.mock('electron-updater', () => {
  const mockUpdater = {
    checkForUpdates: vi.fn().mockResolvedValue({}),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    logger: null,
    autoDownload: false,
  };
  return {
    autoUpdater: mockUpdater,
  };
});

// Mock internal services
vi.mock('../../src/main/services/settings-service', () => ({
  SettingsService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../src/main/services/backup-service', () => ({
  backupService: {
    createBackup: vi.fn().mockResolvedValue('test-backup-path'),
    rotateBackups: vi.fn(),
  },
}));

interface UpdateServiceWithPrivates extends UpdateService {
  instance: UpdateService | undefined;
}

describe('UpdateService', () => {
  let service: UpdateService;
  let mockSettings: { autoUpdateEnabled: boolean };

  beforeEach(() => {
    vi.clearAllMocks();
    (UpdateService as unknown as UpdateServiceWithPrivates).instance = undefined;

    mockSettings = { autoUpdateEnabled: true };
    const settingsServiceInstance = {
      getConfig: vi.fn(() => mockSettings),
    };
    (SettingsService.getInstance as Mock).mockReturnValue(settingsServiceInstance);

    // Initial mock for BrowserWindow
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    service = UpdateService.getInstance();
  });

  describe('initialize', () => {
    it('should NOT check for updates if autoUpdateEnabled is false in production', () => {
      mockSettings.autoUpdateEnabled = false;
      const appMock = vi.mocked(app) as unknown as { isPackaged: boolean };
      appMock.isPackaged = true;

      service.initialize();

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    });

    it('should check for updates if autoUpdateEnabled is true in production', () => {
      mockSettings.autoUpdateEnabled = true;
      const appMock = vi.mocked(app) as unknown as { isPackaged: boolean };
      appMock.isPackaged = true;

      service.initialize();

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    });
  });

  describe('checkForUpdates', () => {
    it('should simulate NOT_AVAILABLE update in development mode', async () => {
      const appMock = vi.mocked(app) as unknown as { isPackaged: boolean };
      appMock.isPackaged = false;
      process.env.NODE_ENV = 'development';

      const mockWin = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      } as unknown as BrowserWindow;
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWin]);

      await service.checkForUpdates();

      const sendCalls = (mockWin.webContents.send as Mock).mock.calls;
      expect(sendCalls.some((call) => call[1].status === UpdateStatus.CHECKING)).toBe(true);
      expect(sendCalls.some((call) => call[1].status === UpdateStatus.NOT_AVAILABLE)).toBe(true);
    });
  });

  describe('installUpdate', () => {
    it('should create a safety backup before calling quitAndInstall', async () => {
      await service.installUpdate();

      expect(backupService.createBackup).toHaveBeenCalled();
      expect(backupService.rotateBackups).toHaveBeenCalledWith(expect.anything(), 3);
      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });

    it('should proceed with quitAndInstall even if backup fails', async () => {
      (backupService.createBackup as Mock).mockRejectedValue(new Error('Backup failed'));

      await service.installUpdate();

      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });
  });

  describe('event listeners', () => {
    it('should respond to update-available event', () => {
      const listenerCall = (autoUpdater.on as Mock).mock.calls.find(
        (call) => call[0] === 'update-available'
      );
      expect(listenerCall).toBeDefined();

      const listener = listenerCall[1];
      const mockUpdateInfo = {
        version: '2.0.0',
        releaseDate: '2026-01-01',
        releaseNotes: 'New features',
      };

      const mockWin = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      } as unknown as BrowserWindow;
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWin]);

      listener(mockUpdateInfo);

      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: UpdateStatus.AVAILABLE,
          updateInfo: expect.objectContaining({
            version: '2.0.0',
          }),
        })
      );
    });
  });
});
