import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const { mockSafeStorage } = vi.hoisted(() => {
  return {
    mockSafeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(true),
      encryptString: vi.fn().mockImplementation((str) => Buffer.from(str)),
      decryptString: vi.fn().mockImplementation((buf) => buf.toString()),
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

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  const testUserData = './test-data/userData';
  const tokenPath = path.join(testUserData, 'google_tokens.enc');

  beforeEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true });
    }
    fs.mkdirSync(testUserData, { recursive: true });

    // Reset singleton
    (GoogleAuthService as any).instance = undefined;
    service = GoogleAuthService.getInstance();
  });

  it('should save tokens to disk when setCredentials is called', () => {
    const mockTokens = { access_token: 'test-access', refresh_token: 'test-refresh' };

    (service as any).setCredentials(mockTokens);

    expect(fs.existsSync(tokenPath)).toBe(true);
    const savedData = fs.readFileSync(tokenPath).toString();
    expect(JSON.parse(savedData)).toEqual(mockTokens);
  });

  it('should save tokens during background refresh via tokens event', () => {
    const initialTokens = { access_token: 'old-access', refresh_token: 'test-refresh' };
    const newTokens = { access_token: 'new-access' };

    // Set initial state
    (service as any).setCredentials(initialTokens);

    // Simulate 'tokens' event from oauth2Client
    const client = service.getClient();
    client.emit('tokens', newTokens);

    const savedData = fs.readFileSync(tokenPath).toString();
    const parsed = JSON.parse(savedData);

    expect(parsed.access_token).toBe('new-access');
    expect(parsed.refresh_token).toBe('test-refresh'); // Should preserve refresh_token
  });

  it('should load tokens from disk on initialization', () => {
    const mockTokens = { access_token: 'loaded-access', refresh_token: 'loaded-refresh' };
    fs.writeFileSync(tokenPath, JSON.stringify(mockTokens));

    // Force re-init to trigger loadTokens
    (GoogleAuthService as any).instance = undefined;
    const newService = GoogleAuthService.getInstance();

    expect(newService.isAuthenticated()).toBe(true);
    expect(newService.getClient().credentials.access_token).toBe('loaded-access');
  });

  it('should clear tokens from disk on logout', () => {
    const mockTokens = { access_token: 'test' };
    fs.writeFileSync(tokenPath, JSON.stringify(mockTokens));

    service.logout();

    expect(fs.existsSync(tokenPath)).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });
});
