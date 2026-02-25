/**
 * Update Status Enum
 */
export enum UpdateStatus {
  IDLE = 'idle',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not-available',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  ERROR = 'error',
}

/**
 * Update Information
 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  isMandatory?: boolean;
}

/**
 * Download Progress
 */
export interface UpdateProgress {
  percent: number;
  total: number;
  transferred: number;
  bytesPerSecond: number;
}
