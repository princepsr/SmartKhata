/**
 * Base Service Error Classes
 *
 * Common error types for service layer business logic.
 * These errors are framework-agnostic and contain business context.
 */

/**
 * Base class for all service errors
 */
export abstract class ServiceError extends Error {
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, code: string, isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get user-friendly error message
   * Override in subclasses for custom messages
   */
  public getUserMessage(): string {
    return this.message;
  }
}

/**
 * Validation Error
 *
 * Thrown when input validation fails.
 * Examples: invalid quantity, missing required fields, format errors
 */
export class ValidationError extends ServiceError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }

  public getUserMessage(): string {
    if (this.field) {
      return `Invalid ${this.field}: ${this.message}`;
    }
    return this.message;
  }
}

/**
 * Business Rule Error
 *
 * Thrown when business rules are violated.
 * Examples: insufficient stock, credit limit exceeded, duplicate entry
 */
export class BusinessError extends ServiceError {
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, code);
    this.context = context;
  }
}

/**
 * Not Found Error
 *
 * Thrown when a requested entity is not found.
 */
export class NotFoundError extends ServiceError {
  public readonly entityType: string;
  public readonly entityId: string | number;

  constructor(entityType: string, entityId: string | number) {
    super(`${entityType} not found: ${entityId}`, 'NOT_FOUND');
    this.entityType = entityType;
    this.entityId = entityId;
  }

  public getUserMessage(): string {
    return `${this.entityType} not found`;
  }
}

/**
 * Insufficient Stock Error
 *
 * Thrown when trying to deduct more stock than available.
 */
export class InsufficientStockError extends BusinessError {
  public readonly productId: number;
  public readonly productName: string;
  public readonly available: number;
  public readonly required: number;

  constructor(productId: number, productName: string, available: number, required: number) {
    super(
      `Insufficient stock for ${productName}. Available: ${available}, Required: ${required}`,
      'INSUFFICIENT_STOCK',
      { productId, productName, available, required }
    );
    this.productId = productId;
    this.productName = productName;
    this.available = available;
    this.required = required;
  }

  public getUserMessage(): string {
    return `Not enough stock for ${this.productName}. Available: ${this.available}, Required: ${this.required}.`;
  }
}

/**
 * Duplicate Entry Error
 *
 * Thrown when trying to create a duplicate entry.
 */
export class DuplicateEntryError extends BusinessError {
  public readonly field: string;
  public readonly value: any;

  constructor(entityType: string, field: string, value: any) {
    super(`${entityType} with ${field} '${value}' already exists`, 'DUPLICATE_ENTRY', {
      entityType,
      field,
      value,
    });
    this.field = field;
    this.value = value;
  }

  public getUserMessage(): string {
    // Format: "Product with this [Field] already exists"
    // This allows frontend to easily parse the field name
    const fieldName = this.field.charAt(0).toUpperCase() + this.field.slice(1);
    return `Product with this ${fieldName} already exists`;
  }
}

/**
 * Inactive Entity Error
 *
 * Thrown when trying to use an inactive entity.
 */
export class InactiveEntityError extends BusinessError {
  public readonly entityType: string;
  public readonly entityId: number;

  constructor(entityType: string, entityId: number) {
    super(`Cannot use inactive ${entityType}`, 'INACTIVE_ENTITY', { entityType, entityId });
    this.entityType = entityType;
    this.entityId = entityId;
  }

  public getUserMessage(): string {
    return `This ${this.entityType} is inactive and cannot be used`;
  }
}

/**
 * Invalid Quantity Error
 *
 * Thrown when quantity is invalid (negative, zero, too large, etc.)
 */
export class InvalidQuantityError extends ValidationError {
  constructor(message: string, quantity?: number) {
    super(message, 'quantity', quantity);
  }
}

/**
 * Credit Limit Exceeded Error
 *
 * Thrown when customer credit limit is exceeded.
 */
export class CreditLimitExceededError extends BusinessError {
  public readonly customerId: number;
  public readonly currentBalance: number;
  public readonly creditLimit: number;
  public readonly attemptedAmount: number;

  constructor(
    customerId: number,
    currentBalance: number,
    creditLimit: number,
    attemptedAmount: number
  ) {
    super(
      `Credit limit exceeded. Current: ₹${currentBalance}, Limit: ₹${creditLimit}, Attempted: ₹${attemptedAmount}`,
      'CREDIT_LIMIT_EXCEEDED',
      { customerId, currentBalance, creditLimit, attemptedAmount }
    );
    this.customerId = customerId;
    this.currentBalance = currentBalance;
    this.creditLimit = creditLimit;
    this.attemptedAmount = attemptedAmount;
  }

  public getUserMessage(): string {
    return `Customer credit limit exceeded. Current balance: ₹${this.currentBalance}`;
  }
}

/**
 * License Error
 *
 * Thrown when license validation fails.
 */
export class LicenseError extends BusinessError {
  constructor(message: string, code: string = 'LICENSE_ERROR') {
    super(message, code);
  }

  public getUserMessage(): string {
    return this.message;
  }
}

/**
 * Check if error is a service error
 */
export function isServiceError(error: any): error is ServiceError {
  return error instanceof ServiceError;
}

/**
 * Get user-friendly message from any error
 */
export function getUserFriendlyMessage(error: any): string {
  if (isServiceError(error)) {
    return error.getUserMessage();
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}
