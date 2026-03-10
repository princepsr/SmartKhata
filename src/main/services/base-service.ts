/**
 * Base Service Class
 * 
 * Provides common utilities for all service classes.
 * Framework-agnostic, no Electron or IPC dependencies.
 */

import { logger } from '../utils/logger';

/**
 * Standard Service Response
 * 
 * Used for operations that may have warnings or metadata.
 */
export interface ServiceResponse<T> {
  data: T;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Base Service
 * 
 * All service classes should extend this base class.
 */
export abstract class BaseService {
  protected logger: typeof logger;

  constructor() {
    this.logger = logger;
  }

  /**
   * Create a simple success response
   */
  protected success<T>(data: T): ServiceResponse<T> {
    return { data };
  }

  /**
   * Create a success response with warnings
   */
  protected successWithWarnings<T>(
    data: T,
    warnings: string[]
  ): ServiceResponse<T> {
    return { data, warnings };
  }

  /**
   * Create a success response with metadata
   */
  protected successWithMetadata<T>(
    data: T,
    metadata: Record<string, unknown>
  ): ServiceResponse<T> {
    return { data, metadata };
  }

  /**
   * Log info message
   */
  protected logInfo(message: string, context?: Record<string, unknown>): void {
    this.logger.info(message, context);
  }

  /**
   * Log warning message
   */
  protected logWarning(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(message, context);
  }

  /**
   * Log error message
   */
  protected logError(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errorData = {
      error,
      ...context
    };
    this.logger.error(message, errorData);
  }
}
