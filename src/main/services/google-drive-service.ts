/**
 * Google Drive Service
 *
 * Handles file operations on Google Drive.
 * Manages the single sync file for SmartKhata backups.
 */

import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import { googleAuthService } from './google-auth-service';
import { GOOGLE_CONFIG } from '@shared/constants/google-constants';
import { logger } from '../utils/logger';

export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private drive: drive_v3.Drive;

  private constructor() {
    this.drive = google.drive({ version: 'v3', auth: googleAuthService.getClient() });
  }

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  /**
   * Synchronize a local backup to Google Drive
   *
   * If the file exists, it updates it. Otherwise, it creates a new one.
   * @param localFilePath - Path to the local .zip backup
   */
  public async syncBackup(
    localFilePath: string
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      if (!googleAuthService.isAuthenticated()) {
        throw new Error('User not authenticated with Google');
      }

      if (!fs.existsSync(localFilePath)) {
        throw new Error('Local backup file not found');
      }

      // 1. Search for existing backup file
      const existingFileId = await this.findExistingBackup();

      if (existingFileId) {
        // 2. Update existing file
        logger.info('Updating existing backup on Google Drive', { fileId: existingFileId });
        await this.drive.files.update({
          fileId: existingFileId,
          media: {
            mimeType: GOOGLE_CONFIG.BACKUP_MIME_TYPE,
            body: fs.createReadStream(localFilePath),
          },
        });
        return { success: true, fileId: existingFileId };
      } else {
        // 3. Create new file
        logger.info('Creating new backup on Google Drive');
        const response = await this.drive.files.create({
          requestBody: {
            name: GOOGLE_CONFIG.BACKUP_FILE_NAME,
            mimeType: GOOGLE_CONFIG.BACKUP_MIME_TYPE,
          },
          media: {
            mimeType: GOOGLE_CONFIG.BACKUP_MIME_TYPE,
            body: fs.createReadStream(localFilePath),
          },
        });
        return { success: true, fileId: response.data.id || undefined };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      logger.error('Google Drive sync failed', { error });
      return { success: false, error: message };
    }
  }

  /**
   * Find the existing backup file by name
   */
  private async findExistingBackup(): Promise<string | null> {
    const response = await this.drive.files.list({
      q: `name = '${GOOGLE_CONFIG.BACKUP_FILE_NAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = response.data.files || [];
    return files.length > 0 ? (files[0].id ?? null) : null;
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
      const response = await this.drive.files.list({
        q: `name = '${GOOGLE_CONFIG.BACKUP_FILE_NAME}' and trashed = false`,
        fields: 'files(id, name, size, modifiedTime)',
        spaces: 'drive',
      });

      const files = response.data.files || [];
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
      logger.error('Failed to get Google Drive backup metadata', { error });
      return null;
    }
  }

  /**
   * Download the backup file from Google Drive to a local path
   * @param localDestination - Path where the file should be saved
   */
  public async downloadBackup(
    localDestination: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fileId = await this.findExistingBackup();
      if (!fileId) {
        throw new Error('Backup file not found on Google Drive');
      }

      const dest = fs.createWriteStream(localDestination);
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => {
            logger.info('Downloaded backup from Google Drive', { path: localDestination });
            resolve({ success: true });
          })
          .on('error', (err) => {
            logger.error('Error downloading from Google Drive', { error: err });
            reject({ success: false, error: err.message });
          })
          .pipe(dest);
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown download error';
      logger.error('Google Drive download failed', { error });
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

      const oauth2 = google.oauth2({ version: 'v2', auth: googleAuthService.getClient() });
      const response = await oauth2.userinfo.get();
      return {
        email: response.data.email || 'Unknown Account',
      };
    } catch (error: unknown) {
      // Improved error logging to capture actual message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get Google profile', { error: errorMessage });
      return null;
    }
  }
}

export const googleDriveService = GoogleDriveService.getInstance();
