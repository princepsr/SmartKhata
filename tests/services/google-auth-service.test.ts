import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockSafeStorage } = vi.hoisted(() => {
  return {
    mockSafeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(true),
      encryptString: vi.fn().mockImplementation((str: string) => Buffer.from(str)),
      decryptString: vi.fn().mockImplementation((buf: Buffer) => buf.toString()),
    },
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('./test-data/userData'),
    isReady: vi.fn().mockReturnValue(true),
    once: vi.fn(),
  },
  safeStorage: mockSafeStorage,
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GoogleAuthService } from '../../src/main/services/google-auth-service';

interface GoogleAuthServiceWithPrivates extends GoogleAuthService {
  instance: GoogleAuthService | undefined;
  getToken: (code: string) => Promise<void>;
}

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let servicePriv: GoogleAuthServiceWithPrivates;
  const testUserData = './test-data/userData';
  const tokenPath = path.join(testUserData, 'google_tokens.enc');

  beforeEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true });
    }
    fs.mkdirSync(testUserData, { recursive: true });

    // Reset singleton
    (GoogleAuthService as unknown as GoogleAuthServiceWithPrivates).instance = undefined;
    service = GoogleAuthService.getInstance();
    servicePriv = service as unknown as GoogleAuthServiceWithPrivates;
    
    // Mock global fetch
    global.fetch = vi.fn() as Mock;
  });

  it('should save tokens to disk when internal setCredentials is used (via getToken)', async () => {
    const mockTokens = { 
      access_token: 'test-access', 
      refresh_token: 'test-refresh',
      expires_in: 3600
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTokens),
    } as Response);

    // Call private getToken
    await servicePriv.getToken('mock-code');

    expect(fs.existsSync(tokenPath)).toBe(true);
    const savedData = fs.readFileSync(tokenPath).toString();
    const parsed = JSON.parse(savedData);
    expect(parsed.access_token).toBe('test-access');
    expect(parsed.refresh_token).toBe('test-refresh');
  });

  it('should load tokens from disk on initialization', () => {
    const mockTokens = { access_token: 'loaded-access', refresh_token: 'loaded-refresh' };
    fs.writeFileSync(tokenPath, JSON.stringify(mockTokens));

    // Force re-init to trigger loadTokens
    (GoogleAuthService as unknown as GoogleAuthServiceWithPrivates).instance = undefined;
    const newService = GoogleAuthService.getInstance();

    expect(newService.isAuthenticated()).toBe(true);
  });

  it('should refresh access token when expired', async () => {
    const initialTokens = { 
      access_token: 'old-access', 
      refresh_token: 'refresh-token',
      expiry_date: Date.now() - 1000 // Expired
    };
    fs.writeFileSync(tokenPath, JSON.stringify(initialTokens));
    
    (GoogleAuthService as unknown as GoogleAuthServiceWithPrivates).instance = undefined;
    service = GoogleAuthService.getInstance();
    servicePriv = service as unknown as GoogleAuthServiceWithPrivates;

    const newTokens = { access_token: 'new-access', expires_in: 3600 };
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newTokens),
    } as Response);

    const token = await service.getAccessToken();

    expect(token).toBe('new-access');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/token'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(Object)
      })
    );
  });

  it('should clear tokens from disk on logout', () => {
    const mockTokens = { access_token: 'test' };
    fs.writeFileSync(tokenPath, JSON.stringify(mockTokens));

    service.logout();

    expect(fs.existsSync(tokenPath)).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });
});
