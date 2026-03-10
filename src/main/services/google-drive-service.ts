/**
 * Google Drive Service
 *
 * Handles file operations on Google Drive.
 * Manages the single sync file for SmartKhata backups.
 */

import fs from 'fs';
import { googleAuthService } from './google-auth-service';
import { GOOGLE_CONFIG } from '@shared/constants/google-constants';
import { logger } from '../utils/logger';

export class GoogleDriveService {
  private static instance: GoogleDriveService;

  private constructor() {}

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  /**
   * Helper to make authenticated requests to Google APIs
   */
  private async fetchGoogle(input: string, init?: RequestInit): Promise<Response> {
    const accessToken = await googleAuthService.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated with Google');
    }

    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
      // Token might be expired, though getAccessToken handles most cases
      await googleAuthService.refreshAccessToken();
      const newAccessToken = await googleAuthService.getAccessToken();
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      return fetch(input, { ...init, headers });
    }

    return response;
  }

  /**
   * Synchronize a local backup to Google Drive
   */
  public async syncBackup(
    localFilePath: string
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      logger.debug('SyncBackup started', { localFilePath });

      if (!googleAuthService.isAuthenticated()) {
        throw new Error('User not authenticated with Google');
      }

      if (!fs.existsSync(localFilePath)) {
        throw new Error('Local backup file not found');
      }

      // 1. Search for existing backup file
      const existingFileId = await this.findExistingBackup();

      // 2. Prepare file content
      const fileBuffer = fs.readFileSync(localFilePath);
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: GOOGLE_CONFIG.BACKUP_FILE_NAME,
        mimeType: GOOGLE_CONFIG.BACKUP_MIME_TYPE,
      };

      const multipartBody = Buffer.concat([
        Buffer.from(delimiter),
        Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
        Buffer.from(JSON.stringify(metadata)),
        Buffer.from(delimiter),
        Buffer.from(`Content-Type: ${GOOGLE_CONFIG.BACKUP_MIME_TYPE}\r\n\r\n`),
        fileBuffer,
        Buffer.from(closeDelimiter),
      ]);

      if (existingFileId) {
        // Update existing file
        logger.info('Updating existing backup on Google Drive', { fileId: existingFileId });
        const response = await this.fetchGoogle(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to update backup: ${error}`);
        }

        logger.info('Google Drive backup updated successfully');
        return { success: true, fileId: existingFileId };
      } else {
        // Create new file
        logger.info('Creating new backup on Google Drive');
        const response = await this.fetchGoogle(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to create backup: ${error}`);
        }

        const data = (await response.json()) as { id: string };
        logger.info('New Google Drive backup created');
        return { success: true, fileId: data.id };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Google Drive sync error', { message });
      return { success: false, error: message };
    }
  }

  /**
   * Find the existing backup file by name
   */
  private async findExistingBackup(): Promise<string | null> {
    const query = encodeURIComponent(`name = '${GOOGLE_CONFIG.BACKUP_FILE_NAME}' and trashed = false`);
    const response = await this.fetchGoogle(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`
    );

    if (!response.ok) {
      throw new Error(`Failed to list files: ${await response.text()}`);
    }

    const data = (await response.json()) as { files?: Array<{ id: string; name: string }> };
    const files = data.files || [];
    return files.length > 0 ? files[0].id : null;
  }

  /**
   * Get metadata for the existing backup file
   */
  public async getBackupMetadata(): Promise<{
    name: string;
    size: string;
    modifiedTime: string;
  } | null> {
    try {
      const query = encodeURIComponent(`name = '${GOOGLE_CONFIG.BACKUP_FILE_NAME}' and trashed = false`);
      const response = await this.fetchGoogle(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&spaces=drive`
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        files?: Array<{ id: string; name: string; size?: string; modifiedTime?: string }>;
      };
      const files = data.files || [];
      if (files.length === 0) {
        return null;
      }

      const file = files[0];
      return {
        name: file.name || GOOGLE_CONFIG.BACKUP_FILE_NAME,
        size: file.size || 'Unknown',
        modifiedTime: file.modifiedTime || new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get Google Drive metadata', error);
      return null;
    }
  }

  /**
   * Download the backup file from Google Drive to a local path
   */
  public async downloadBackup(
    localDestination: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fileId = await this.findExistingBackup();
      if (!fileId) {
        throw new Error('Backup file not found on Google Drive');
      }

      const response = await this.fetchGoogle(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
      );

      if (!response.ok) {
        throw new Error(`Failed to download file: ${await response.text()}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(localDestination, Buffer.from(arrayBuffer));

      logger.info('Downloaded backup from Google Drive', { path: localDestination });
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Google Drive download failed', { message });
      return { success: false, error: message };
    }
  }

  /**
   * Get the linked account profile information
   */
  public async getProfile(): Promise<{ email: string } | null> {
    try {
      if (!googleAuthService.isAuthenticated()) {
        return null;
      }

      const response = await this.fetchGoogle('https://www.googleapis.com/oauth2/v2/userinfo');
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { email?: string };
      return {
        email: data.email || 'Unknown Account',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get Google profile', { message });
      return null;
    }
  }
}

export const googleDriveService = GoogleDriveService.getInstance();
