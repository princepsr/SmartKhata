import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { databaseManager } from '../database';

/**
 * Shutdown Manager
 *
 * Handles graceful shutdown of the application.
 * Provides hooks for cleanup operations (database, backups, etc.)
 */

/**
 * Shutdown Priorities
 * Higher numbers run LATER in the shutdown sequence.
 */
export enum ShutdownPriority {
  NORMAL = 100, // General services, UI cleanup
  HIGH = 200, // Background processes, trackers
  CRITICAL = 300, // Database, log flushes, filesystem markers
}

type ShutdownHook = () => Promise<void> | void;

interface RegisteredHook {
  hook: ShutdownHook;
  priority: ShutdownPriority;
  description?: string;
}

class ShutdownManager {
  private hooks: RegisteredHook[] = [];
  private isShuttingDown = false;

  /**
   * Register a shutdown hook
   * @param hook Async or sync function
   * @param priority Lower numbers run earlier
   * @param description Optional label for logs
   */
  public registerHook(
    hook: ShutdownHook,
    priority: ShutdownPriority = ShutdownPriority.NORMAL,
    description?: string
  ): void {
    this.hooks.push({ hook, priority, description });
    logger.debug('Shutdown hook registered', {
      priority,
      description,
      totalHooks: this.hooks.length,
    });
  }

  /**
   * Execute all shutdown hooks in priority order
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate call');
      return;
    }

    this.isShuttingDown = true;
    logger.info('=== Starting priority-based graceful shutdown ===');

    // Sort hooks by priority (ascending: 100 -> 200 -> 300)
    // For same priority, we follow FIFO (order of registration)
    const sortedHooks = [...this.hooks].sort((a, b) => a.priority - b.priority);

    for (const h of sortedHooks) {
      try {
        const label = h.description || 'unnamed hook';
        logger.info(`Executing shutdown hook: ${label} (Priority: ${h.priority})`);

        // Add a timeout to prevent hanging hooks from blocking shutdown
        // Default 2 seconds per hook
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Shutdown hook "${label}" timed out after 2000ms`)),
            2000
          )
        );

        await Promise.race([h.hook(), timeoutPromise]);
      } catch (error) {
        logger.error(`Shutdown hook failed or timed out: ${h.description}`, error);
      }
    }

    logger.info('=== Graceful shutdown complete ===');
  }

  /**
   * Check if shutdown is in progress
   */
  public isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}

// Singleton instance
export const shutdownManager = new ShutdownManager();

/**
 * Register common shutdown hooks
 */
/**
 * Register common shutdown hooks
 */
export function registerShutdownHooks(): void {
  const markerPath = path.join(app.getPath('userData'), 'clean.exit');

  // 1. Close database connections (CRITICAL)
  shutdownManager.registerHook(
    async () => {
      if (databaseManager.isReady()) {
        databaseManager.close();
      }
    },
    ShutdownPriority.CRITICAL,
    'Database Shutdown'
  );

  // Stop background services (HIGH)
  shutdownManager.registerHook(
    async () => {
      try {
        const { autoBackupService } = await import('../services/auto-backup-service.js');
        autoBackupService.stop();
        logger.info('Auto-backup background tasks stopped');
      } catch (e) {
        logger.error('Failed to stop auto-backup tasks', e);
      }
    },
    ShutdownPriority.HIGH,
    'Auto Backup Service Shutdown'
  );

  // 2. Write the clean exit marker (CRITICAL)
  // Since it's registered AFTER the database hook with SAME priority,
  // and we use stable sort (FIFO for same priority), it runs AFTER the database.
  shutdownManager.registerHook(
    () => {
      try {
        fs.writeFileSync(
          markerPath,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            version: app.getVersion(),
          })
        );
        logger.info('Clean exit marker written');
      } catch (error) {
        logger.error('Failed to write clean exit marker', error);
      }
    },
    ShutdownPriority.CRITICAL,
    'Exit Marker'
  );

  logger.info('Global shutdown hooks registered');
}
