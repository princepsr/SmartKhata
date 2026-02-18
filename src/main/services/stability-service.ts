import { BrowserWindow } from 'electron';
import fs from 'fs';
import { databaseManager } from '../database';
import { logger } from '../utils/logger';
import { shutdownManager, ShutdownPriority } from '../utils/shutdown-manager';

/**
 * Stability Service
 *
 * Monitors application health, memory usage, and ensures resource cleanup.
 * Designed for 8+ hour long-run stability.
 */
const stabilityLogger = logger.forModule('STABILITY');

// Thresholds for warnings
const MEMORY_THRESHOLD_MB = 512;
const DB_SIZE_THRESHOLD_MB = 1024; // 1GB

export class StabilityService {
  private static instance: StabilityService;
  private monitorInterval: NodeJS.Timeout | null = null;
  private trackedWindows: Set<BrowserWindow> = new Set();

  private constructor() {
    // Register cleanup hook
    shutdownManager.registerHook(
      () => this.cleanup(),
      ShutdownPriority.HIGH,
      'Stability Service Resource Cleanup'
    );
  }

  public static getInstance(): StabilityService {
    if (!StabilityService.instance) {
      StabilityService.instance = new StabilityService();
    }
    return StabilityService.instance;
  }

  /**
   * Start periodic health monitoring
   * @param intervalMs How often to log health stats (default 30 mins)
   */
  public startMonitoring(intervalMs: number = 30 * 60 * 1000): void {
    if (this.monitorInterval) {
      return;
    }

    stabilityLogger.info('Starting long-run stability monitoring', { intervalMs });

    // Initial log
    this.logHealthStats();

    this.monitorInterval = setInterval(() => {
      this.logHealthStats();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      stabilityLogger.info('Stability monitoring stopped');
    }
  }

  /**
   * Log high-level health and memory statistics
   */
  public logHealthStats(): void {
    const memory = process.memoryUsage();
    const windowCount = BrowserWindow.getAllWindows().length;

    // Check DB size
    let dbSizeMB = 0;
    try {
      const dbPath = databaseManager.getDatabasePath();
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbSizeMB = stats.size / 1024 / 1024;
      }
    } catch (err) {
      stabilityLogger.error('Failed to check database size', err);
    }

    stabilityLogger.info('System Health Report:', {
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
      },
      windows: {
        active: windowCount,
        tracked: this.trackedWindows.size,
      },
      db: {
        size: `${dbSizeMB.toFixed(2)} MB`,
      },
      uptime: `${(process.uptime() / 3600).toFixed(2)} hours`,
    });

    // Alert if heap used is unusually high
    if (memory.heapUsed > MEMORY_THRESHOLD_MB * 1024 * 1024) {
      stabilityLogger.warn(
        `High memory usage detected (> ${MEMORY_THRESHOLD_MB}MB)! Potential leak in progress.`
      );
    }

    // Alert if DB is growing too fast
    if (dbSizeMB > DB_SIZE_THRESHOLD_MB) {
      stabilityLogger.warn(
        `Large database detected (> ${DB_SIZE_THRESHOLD_MB}MB)! Optimization or archiving recommended.`
      );
    }
  }

  /**
   * Track a BrowserWindow for auto-cleanup
   */
  public trackWindow(window: BrowserWindow): void {
    this.trackedWindows.add(window);
    window.on('closed', () => {
      this.trackedWindows.delete(window);
    });
  }

  /**
   * Cleanup all resources on shutdown
   */
  private cleanup(): void {
    this.stopMonitoring();

    if (this.trackedWindows.size > 0) {
      stabilityLogger.info(`Cleaning up ${this.trackedWindows.size} tracked windows`);
      this.trackedWindows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.destroy();
        }
      });
      this.trackedWindows.clear();
    }
  }
}
