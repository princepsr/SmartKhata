import { EventEmitter } from 'events';
import dns from 'dns';
import { logger } from '../utils/logger';

const connectivityLogger = logger.forModule('CONNECTIVITY');

/**
 * Connectivity Service
 *
 * Simple utility to monitor internet connectivity.
 * Emits 'change' events when status changes.
 */
class ConnectivityService extends EventEmitter {
  private isOnline: boolean = true;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start monitoring
   */
  public start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => this.checkStatus(), 10000); // Check every 10s
    this.checkStatus();
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current status
   */
  public getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Set status (usually called from IPC if frontend detects it first)
   */
  public setStatus(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      connectivityLogger.info(`Connectivity status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);
      this.emit('change', online);
    }
  }

  /**
   * Manually trigger a connectivity check and return result
   */
  public async checkNow(): Promise<boolean> {
    return new Promise((resolve) => {
      dns.lookup('google.com', (err) => {
        const online = !err;
        this.setStatus(online);
        resolve(online);
      });
    });
  }

  /**
   * Check status via DNS lookup
   */
  private checkStatus(): void {
    dns.lookup('google.com', (err) => {
      const online = !err;
      this.setStatus(online);
    });
  }
}

export const connectivityService = new ConnectivityService();
