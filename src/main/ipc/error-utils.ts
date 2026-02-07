/**
 * IPC Error Utilities
 * 
 * Centralized logic for handling, sanitizing, and logging IPC errors.
 * Ensures no sensitive information or stack traces leak to the renderer.
 */

import { logger } from '../utils/logger';
import { ZodError } from 'zod';

/**
 * Standard IPC Error Codes
 */
export enum IPCErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Custom IPC Error Class
 * 
 * Use this to throw errors with specific types/codes from handlers
 */
export class IPCError extends Error {
  constructor(
    public override message: string,
    public type: IPCErrorType = IPCErrorType.INTERNAL,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

/**
 * Sanitize error for renderer consumption
 * 
 * Rules:
 * 1. Zod errors -> Extract first validation message
 * 2. IPCError -> Pass through message
 * 3. Standard Error -> Pass through message (assuming it's safe)
 * 4. Unknown/String -> Pass through or generic message
 * 5. NEVER pass stack traces
 */
export function sanitizeIPCError(error: unknown): string {
  // Handle Zod Errors (Validation)
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return firstIssue.message;
  }

  // Handle Custom IPC Errors
  if (error instanceof IPCError) {
    return error.message;
  }

  // Handle Standard Errors
  if (error instanceof Error) {
    // Determine if it's a "system" error that should be masked
    // For now, we trust Error.message but strip "Error:" prefix if present
    return error.message.replace(/^Error: /, '');
  }

  // Handle String Errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback
  return 'An unexpected error occurred';
}

/**
 * Log IPC Error with context
 */
export function logIPCError(
  channel: string,
  error: unknown,
  requestId: string,
  duration?: number
): void {
  const errorDetails: Record<string, any> = {
    requestId,
    channel,
    duration: duration ? `${duration}ms` : undefined,
  };

  if (error instanceof Error) {
    errorDetails.message = error.message;
    errorDetails.stack = error.stack;
    errorDetails.name = error.name;
    
    if (error instanceof ZodError) {
      errorDetails.validationIssues = error.issues;
    }
  } else {
    errorDetails.error = String(error);
  }

  logger.error(`IPC Error: ${channel}`, errorDetails);
}
