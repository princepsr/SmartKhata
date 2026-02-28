import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    forModule: vi.fn().mockReturnThis(),
  },
}));

// Mock fs to prevent actual file system access
// Must use vi.hoisted() so these fns are available when vi.mock() factory runs
const mockFsFns = vi.hoisted(() => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('mock-file-content')),
  createReadStream: vi.fn().mockReturnValue({}),
  createWriteStream: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    pipe: vi.fn().mockReturnThis(),
  }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
}));

vi.mock('fs', () => ({
  default: mockFsFns,
  ...mockFsFns,
}));

import fs from 'fs';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset existing mock return values to safe defaults after clearAllMocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-file-content'));
    vi.mocked(fs.createReadStream).mockReturnValue({} as any);
    vi.mocked(fs.createWriteStream).mockReturnValue({
      on: vi.fn().mockReturnThis(),
      pipe: vi.fn().mockReturnThis(),
    } as any);

    (GoogleDriveService as any).instance = undefined;
    service = GoogleDriveService.getInstance();
  });

  describe('syncBackup', () => {
    it('should create a new file if backup does not exist on Drive', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-content'));

      mockGoogleDrive.files.list.mockResolvedValue({ data: { files: [] } });
      mockGoogleDrive.files.create.mockResolvedValue({ data: { id: 'new-id' } });

      const result = await service.syncBackup('/some/local/path.zip');

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('new-id');
      expect(mockGoogleDrive.files.create).toHaveBeenCalled();
    });

    it('should update existing file if backup exists on Drive', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-content'));

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
