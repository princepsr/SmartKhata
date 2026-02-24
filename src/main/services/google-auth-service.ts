/**
 * Google Auth Service
 *
 * Handles OAuth2 flow for Google APIs.
 * Includes token exchange, secure storage, and refresh logic.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { app, safeStorage } from 'electron';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { GOOGLE_CONFIG } from '@shared/constants/google-constants';
import { logger } from '../utils/logger';

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private _oauth2Client: OAuth2Client | null = null;
  private tokenPath: string;
  private activeServer: http.Server | null = null;
  private authTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Tokens are stored in the user data directory
    this.tokenPath = path.join(app.getPath('userData'), 'google_tokens.enc');
  }

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Lazy initialization of the OAuth2 client
   */
  private get oauth2Client(): OAuth2Client {
    const clientId = GOOGLE_CONFIG.CLIENT_ID;
    const clientSecret = GOOGLE_CONFIG.CLIENT_SECRET;

    // If we're already initialized but with a placeholder, and now we have a real ID, re-initialize
    if (
      this._oauth2Client &&
      clientId !== 'PLACEHOLDER_CLIENT_ID' &&
      (this._oauth2Client as any)._clientId === 'PLACEHOLDER_CLIENT_ID'
    ) {
      logger.info('Re-initializing Google OAuth2 Client with real credentials');
      this._oauth2Client = null;
    }

    if (!this._oauth2Client) {
      if (clientId === 'PLACEHOLDER_CLIENT_ID') {
        throw new Error(
          'Google Client ID is not configured. Please set GOOGLE_CLIENT_ID in your .env file.'
        );
      }

      logger.info('Initializing Google OAuth2 Client', {
        clientIdStart: clientId.substring(0, 10) + '...',
      });

      this._oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        GOOGLE_CONFIG.REDIRECT_URI
      );

      // safeStorage requires the app to be ready before it can decrypt tokens
      if (app.isReady()) {
        this.loadTokens();
      } else {
        app.once('ready', () => {
          this.loadTokens();
        });
      }

      // Setup auto-refresh
      this._oauth2Client.on('tokens', (newTokens) => {
        logger.info('Google OAuth2 tokens refreshed, updating storage');
        // Update credentials and re-save
        // We merge with current credentials to ensure we don't lose the refresh_token
        // if the refresh response only contains the new access_token
        const currentTokens = this._oauth2Client!.credentials;
        this.setCredentials({ ...currentTokens, ...newTokens });
      });
    }
    return this._oauth2Client;
  }

  /**
   * Check if the user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.oauth2Client.credentials.access_token;
  }

  /**
   * Get the OAuth2 client for API calls
   */
  public getClient(): OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Generate the Auth URL for the user to visit
   */
  public generateAuthUrl(): string {
    if (GOOGLE_CONFIG.CLIENT_ID === 'PLACEHOLDER_CLIENT_ID') {
      throw new Error(
        'Google Client ID is not configured. Please set GOOGLE_CLIENT_ID in your .env file.'
      );
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_CONFIG.SCOPES,
      prompt: 'consent', // Force consent to ensure we get a refresh token
    });
  }

  /**
   * Start a local server to handle the OAuth2 callback
   */
  public async authenticate(): Promise<void> {
    // Ensure any existing server is closed before starting a new one
    this.cancelAuthenticate();

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url?.includes('/oauth2callback')) {
            const query = url.parse(req.url, true).query;
            const code = query.code as string;

            if (code) {
              const { tokens } = await this.oauth2Client.getToken(code);
              this.setCredentials(tokens);

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
        const error = err as { code?: string };
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${GOOGLE_CONFIG.REDIRECT_PORT} is already in use. Auth failed.`);
          reject(
            new Error(
              `Port ${GOOGLE_CONFIG.REDIRECT_PORT} is already in use. Please check if another app is using it.`
            )
          );
        } else {
          logger.error('Auth callback server error', { error: err });
          reject(err);
        }
        this.cancelAuthenticate();
      });

      server.listen(GOOGLE_CONFIG.REDIRECT_PORT, () => {
        logger.info(`Auth callback server listening on port ${GOOGLE_CONFIG.REDIRECT_PORT}`);
      });

      // Cleanup server after 10 minutes if no response
      this.authTimeout = setTimeout(() => {
        this.cancelAuthenticate();
        reject(new Error('Authentication timed out'));
      }, 600000);
    });
  }

  /**
   * Cancel any pending authentication and free the port
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
   * Set credentials and save tokens securely
   */
  private setCredentials(tokens: import('google-auth-library').Credentials) {
    this.oauth2Client.setCredentials(tokens);
    this.saveTokens(tokens);
  }

  /**
   * Save tokens to disk using Electron's safeStorage
   */
  private saveTokens(tokens: import('google-auth-library').Credentials) {
    try {
      const tokenStr = JSON.stringify(tokens);
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(tokenStr);
        fs.writeFileSync(this.tokenPath, encrypted);
      } else {
        // Fallback to plain text if encryption is not available (not recommended for production)
        fs.writeFileSync(this.tokenPath, tokenStr);
        logger.warn('Encryption not available, saving tokens in plain text');
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to save Google tokens', {
        message: err.message,
        stack: err.stack,
        code: (err as any).code,
      });
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
          tokenStr = safeStorage.decryptString(data);
        } else {
          tokenStr = data.toString();
        }

        const tokens = JSON.parse(tokenStr);
        this.oauth2Client.setCredentials(tokens);
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to load Google tokens', {
        message: err.message,
        stack: err.stack,
        code: (err as any).code,
      });
    }
  }

  /**
   * Log out and clear tokens
   */
  public logout() {
    this.oauth2Client.setCredentials({});
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }
}

export const googleAuthService = GoogleAuthService.getInstance();
