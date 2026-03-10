/**
 * Google Auth Service
 *
 * Handles OAuth2 flow for Google APIs.
 * Includes token exchange, secure storage, and refresh logic.
 */

import { app, safeStorage } from 'electron';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { GOOGLE_CONFIG } from '@shared/constants/google-constants';
import { logger } from '../utils/logger';

export interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private tokens: GoogleTokens = {};
  private tokenPath: string;
  private activeServer: http.Server | null = null;
  private authTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.tokenPath = path.join(app.getPath('userData'), 'google_tokens.enc');
    const initTokens = () => {
      this.loadTokens();
    };

    if (app.isReady()) {
      initTokens();
    } else {
      app.once('ready', initTokens);
    }
  }

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Check if the user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.tokens.access_token;
  }

  /**
   * Get the access token, refreshing if necessary
   */
  public async getAccessToken(): Promise<string | null> {
    if (!this.tokens.access_token) {
      return null;
    }

    // Check if token is expired or expiring soon (within 5 minutes)
    const isExpired = this.tokens.expiry_date ? Date.now() > this.tokens.expiry_date - 300000 : false;

    if (isExpired && this.tokens.refresh_token) {
      await this.refreshAccessToken();
    }

    return this.tokens.access_token || null;
  }

  /**
   * Generate the Auth URL for the user to visit
   */
  public generateAuthUrl(): string {
    const clientId = GOOGLE_CONFIG.CLIENT_ID;
    if (clientId === 'PLACEHOLDER_CLIENT_ID') {
      throw new Error('Google Client ID is not configured.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: GOOGLE_CONFIG.REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_CONFIG.SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }


  /**
   * Start a local server to handle the OAuth2 callback
   */
  public async authenticate(): Promise<void> {
    this.cancelAuthenticate();

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url?.includes('/oauth2callback')) {
            const query = url.parse(req.url, true).query;
            const code = query.code as string;

            if (code) {
              await this.getToken(code);

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication Successful!</h1><p>You can close this window now.</p>');

              this.cancelAuthenticate();
              resolve();
            } else {
              throw new Error('No authorization code found');
            }
          }
        } catch (error) {
          logger.error('Authentication callback error', { error });
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Failed</h1><p>Please check the logs.</p>');
          this.cancelAuthenticate();
          reject(error);
        }
      });

      this.activeServer = server;

      server.on('error', (err: unknown) => {
        const error = err as { code?: string; message?: string };
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${GOOGLE_CONFIG.REDIRECT_PORT} is already in use. Auth failed.`);
          reject(new Error(`Port ${GOOGLE_CONFIG.REDIRECT_PORT} is already in use.`));
        } else {
          logger.error('Auth callback server error', { error });
          reject(err);
        }
        this.cancelAuthenticate();
      });

      server.listen(GOOGLE_CONFIG.REDIRECT_PORT, () => {
        logger.info(`Auth callback server listening on port ${GOOGLE_CONFIG.REDIRECT_PORT}`);
      });

      this.authTimeout = setTimeout(() => {
        this.cancelAuthenticate();
        reject(new Error('Authentication timed out'));
      }, 600000);
    });
  }

  /**
   * Cancel any pending authentication
   */
  public cancelAuthenticate() {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }

    if (this.activeServer) {
      this.activeServer.close();
      this.activeServer = null;
      logger.info('Auth callback server closed');
    }
  }

  /**
   * Exchange code for tokens
   */
  private async getToken(code: string): Promise<void> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        client_secret: GOOGLE_CONFIG.CLIENT_SECRET,
        redirect_uri: GOOGLE_CONFIG.REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = (await response.json()) as GoogleTokens & { expires_in?: number };
    this.setCredentials({
      ...data,
      expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    });
  }

  /**
   * Refresh the access token
   */
  public async refreshAccessToken(): Promise<void> {
    if (!this.tokens.refresh_token) {
      throw new Error('No refresh token available');
    }

    logger.info('Refreshing Google access token...');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        client_secret: GOOGLE_CONFIG.CLIENT_SECRET,
        refresh_token: this.tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = (await response.json()) as GoogleTokens & { expires_in?: number };
    this.setCredentials({
      ...this.tokens,
      ...data,
      expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    });
  }

  /**
   * Set credentials and save tokens securely
   */
  private setCredentials(tokens: GoogleTokens) {
    this.tokens = tokens;
    this.saveTokens(tokens);
  }

  /**
   * Save tokens to disk using Electron's safeStorage
   */
  private saveTokens(tokens: GoogleTokens) {
    try {
      const tokenStr = JSON.stringify(tokens);
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(tokenStr);
        fs.writeFileSync(this.tokenPath, encrypted);
      } else {
        fs.writeFileSync(this.tokenPath, tokenStr);
        logger.warn('Encryption not available, saving tokens in plain text');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save Google tokens', { message });
    }
  }

  /**
   * Load tokens from disk
   */
  private loadTokens() {
    try {
      if (fs.existsSync(this.tokenPath)) {
        const data = fs.readFileSync(this.tokenPath);
        let tokenStr: string;

        if (safeStorage.isEncryptionAvailable()) {
          try {
            tokenStr = safeStorage.decryptString(data);
          } catch (decryptErr) {
            logger.error('SafeStorage decryption failed', decryptErr);
            return;
          }
        } else {
          tokenStr = data.toString();
        }

        this.tokens = JSON.parse(tokenStr);
        logger.debug('Google tokens loaded successfully');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load Google tokens', { message });
    }
  }

  /**
   * Log out and clear tokens
   */
  public logout() {
    this.tokens = {};
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }
}

export const googleAuthService = GoogleAuthService.getInstance();
