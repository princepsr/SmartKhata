import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleDriveService } from '../../src/main/services/google-drive-service';
import fs from 'fs';

vi.mock('../../src/main/services/google-auth-service', () => ({
  googleAuthService: {
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    refreshAccessToken: vi.fn(),
  },
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    forModule: vi.fn().mockReturnThis(),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { googleAuthService } from '../../src/main/services/google-auth-service';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    (GoogleDriveService as any).instance = undefined;
    service = GoogleDriveService.getInstance();
    
    // Mock global fetch
    global.fetch = vi.fn();
    
    vi.mocked(googleAuthService.isAuthenticated).mockReturnValue(true);
    vi.mocked(googleAuthService.getAccessToken).mockResolvedValue('mock-token');
  });

  describe('syncBackup', () => {
    it('should create a new file if backup does not exist on Drive', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-content'));

      // Mock findExistingBackup (list files) -> empty
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      } as Response);

      // Mock create (POST)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-id' }),
      } as Response);

      const result = await service.syncBackup('/some/local/path.zip');

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('new-id');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should update existing file if backup exists on Drive', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-content'));

      // Mock findExistingBackup (list files) -> exists
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [{ id: 'existing-id' }] }),
      } as Response);

      // Mock update (PATCH)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'existing-id' }),
      } as Response);

      const result = await service.syncBackup('/some/local/path.zip');

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('existing-id');
      expect(vi.mocked(global.fetch).mock.calls[1][1]?.method).toBe('PATCH');
    });
  });

  describe('downloadBackup', () => {
    it('should download file if it exists on Drive', async () => {
      // Mock findExistingBackup (list files) -> exists
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [{ id: 'drive-id' }] }),
      } as Response);

      // Mock download (GET alt=media)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as Response);

      const result = await service.downloadBackup('/dest/path.zip');
      expect(result.success).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle missing file on Drive', async () => {
      // Mock findExistingBackup (list files) -> empty
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      } as Response);

      const result = await service.downloadBackup('/dest/path.zip');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getProfile', () => {
    it('should return account email on success', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ email: 'test@gmail.com' }),
      } as Response);

      const profile = await service.getProfile();
      expect(profile).toEqual({ email: 'test@gmail.com' });
    });
    
    it('should return null if not authenticated', async () => {
      vi.mocked(googleAuthService.isAuthenticated).mockReturnValue(false);
      const profile = await service.getProfile();
      expect(profile).toBeNull();
    });
  });
});
