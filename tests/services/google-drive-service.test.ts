import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { GoogleDriveService } from '../../src/main/services/google-drive-service';

const { mockGoogleApiClient, mockGoogleDrive, mockGoogleOAuth2 } = vi.hoisted(() => {
  const drive = {
    files: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
  };
  const oauth2 = {
    userinfo: {
      get: vi.fn(),
    },
  };
  return {
    mockGoogleDrive: drive,
    mockGoogleOAuth2: oauth2,
    mockGoogleApiClient: {
      drive: vi.fn().mockReturnValue(drive),
      oauth2: vi.fn().mockReturnValue(oauth2),
    },
  };
});

vi.mock('googleapis', () => ({
  google: {
    ...mockGoogleApiClient,
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        credentials: {},
      })),
    },
  },
}));

vi.mock('../../src/main/services/google-auth-service', () => ({
  googleAuthService: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    getClient: vi.fn().mockReturnValue({}),
  },
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock stream for downloadBackup
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    createReadStream: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      pipe: vi.fn().mockReturnThis(),
    }),
    existsSync: vi.fn(),
  };
});

import { googleAuthService } from '../../src/main/services/google-auth-service';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    (GoogleDriveService as any).instance = undefined;
    service = GoogleDriveService.getInstance();
    // Debug: Check if drive is mocked
    console.log('DEBUG: service.drive exists:', !!(service as any).drive);
    console.log('DEBUG: service.drive.files exists:', !!(service as any).drive?.files);
  });

  describe('syncBackup', () => {
    it('should create a new file if backup does not exist on Drive', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs as any, 'createReadStream').mockReturnValue({} as any);

      mockGoogleDrive.files.list.mockResolvedValue({ data: { files: [] } });
      mockGoogleDrive.files.create.mockResolvedValue({ data: { id: 'new-id' } });

      const result = await service.syncBackup('/some/local/path.zip');

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('new-id');
      expect(mockGoogleDrive.files.create).toHaveBeenCalled();
    });

    it('should update existing file if backup exists on Drive', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs as any, 'createReadStream').mockReturnValue({} as any);

      mockGoogleDrive.files.list.mockResolvedValue({ data: { files: [{ id: 'existing-id' }] } });
      mockGoogleDrive.files.update.mockResolvedValue({ data: { id: 'existing-id' } });

      const result = await service.syncBackup('/some/local/path.zip');

      expect(result.success).toBe(true);
      expect(mockGoogleDrive.files.update).toHaveBeenCalled();
    });
  });

  describe('downloadBackup', () => {
    it('should download file if it exists on Drive', async () => {
      mockGoogleDrive.files.list.mockResolvedValue({ data: { files: [{ id: 'drive-id' }] } });

      const mockStream: any = {
        on: vi.fn((event, cb) => {
          if (event === 'end') {
            cb();
          }
          return mockStream;
        }),
        pipe: vi.fn().mockReturnThis(),
      };

      mockGoogleDrive.files.get.mockResolvedValue({ data: mockStream });

      const result = await service.downloadBackup('/dest/path.zip');
      expect(result.success).toBe(true);
      expect(mockGoogleDrive.files.get).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'drive-id', alt: 'media' }),
        expect.objectContaining({ responseType: 'stream' })
      );
    });

    it('should handle missing file on Drive', async () => {
      mockGoogleDrive.files.list.mockResolvedValue({ data: { files: [] } });
      const result = await service.downloadBackup('/dest/path.zip');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getProfile', () => {
    it('should return account email on success', async () => {
      mockGoogleOAuth2.userinfo.get.mockResolvedValue({ data: { email: 'test@gmail.com' } });
      const profile = await service.getProfile();
      expect(profile).toEqual({ email: 'test@gmail.com' });
    });
  });
});
