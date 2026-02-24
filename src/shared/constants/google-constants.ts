/**
 * Google API Constants
 */

export const GOOGLE_CONFIG = {
  // Scopes required for authentication and drive access
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file', // Access to files created/opened by this app
    'https://www.googleapis.com/auth/userinfo.email', // For identifying the linked account
  ],

  // Backup Configuration
  BACKUP_FILE_NAME: 'SmartKhata_Auto_Backup.zip',
  BACKUP_MIME_TYPE: 'application/zip',

  // Authentication Configuration
  // Note: These use getters to ensure they read process.env AFTER data is loaded by loadEnv()
  get CLIENT_ID() {
    return process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_CLIENT_ID';
  },
  get CLIENT_SECRET() {
    return process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_CLIENT_SECRET';
  },
  REDIRECT_PORT: 8888,
  REDIRECT_URI: 'http://localhost:8888/oauth2callback',
};
