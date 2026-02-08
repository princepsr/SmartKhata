/**
 * Base Service Class
 * 
 * Provides common utilities for all service classes.
 * Framework-agnostic, no Electron or IPC dependencies.
 */

import { Logger } from '../utils/logger';

/**
 * Standard Service Response
 * 
 * Used for operations that may have warnings or metadata.
 */
export interface ServiceResponse<T> {
  data: T;
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Base Service
 * 
 * All service classes should extend this base class.
 */
export abstract class BaseService {
  protected logger: Logger;

  constructor() {
    this.logger = Logger;
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
    metadata: Record<string, any>
  ): ServiceResponse<T> {
    return { data, metadata };
  }

  /**
   * Log info message
   */
  protected logInfo(message: string, context?: Record<string, any>): void {
    this.logger.info(message, context);
  }

  /**
   * Log warning message
   */
  protected logWarning(message: string, context?: Record<string, any>): void {
    this.logger.warn(message, context);
  }

  /**
   * Log error message
   */
  protected logError(message: string, error?: any, context?: Record<string, any>): void {
    this.logger.error(message, error, context);
  }
}
