import { logger } from '../utils/logger';

/**
 * Shutdown Manager
 * 
 * Handles graceful shutdown of the application.
 * Provides hooks for cleanup operations (database, backups, etc.)
 */

type ShutdownHook = () => Promise<void> | void;

class ShutdownManager {
  private hooks: ShutdownHook[] = [];
  private isShuttingDown = false;

  /**
   * Register a shutdown hook
   * Hooks are executed in reverse order (LIFO)
   */
  public registerHook(hook: ShutdownHook): void {
    this.hooks.push(hook);
    logger.debug('Shutdown hook registered', { totalHooks: this.hooks.length });
  }

  /**
   * Execute all shutdown hooks
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate call');
      return;
    }

    this.isShuttingDown = true;
    logger.info('=== Starting graceful shutdown ===');

    // Execute hooks in reverse order (LIFO)
    const reversedHooks = [...this.hooks].reverse();

    for (let i = 0; i < reversedHooks.length; i++) {
      const hook = reversedHooks[i];
      try {
        logger.debug(`Executing shutdown hook ${i + 1}/${reversedHooks.length}`);
        await hook();
      } catch (error) {
        logger.error(`Shutdown hook ${i + 1} failed`, error);
        // Continue with other hooks even if one fails
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
export function registerShutdownHooks(): void {
  // Future: Close database connections
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Close database (placeholder)');
    // TODO: await database.close();
  });

  // Future: Trigger backup
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Trigger backup (placeholder)');
    // TODO: await backupService.createBackup();
  });

  // Future: Flush pending logs
  shutdownManager.registerHook(async () => {
    logger.info('Shutdown hook: Flush logs (placeholder)');
    // TODO: await logger.flush();
  });

  logger.info('Shutdown hooks registered', { count: 3 });
}
