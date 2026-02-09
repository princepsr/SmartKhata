# Testing Guide

## Overview

This guide explains how to run and write tests for the SmartKhata POS application.

---

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Run Tests in Watch Mode

```bash
pnpm test:watch
```

### Run Tests with UI

```bash
pnpm test:ui
```

### Run Tests Once (CI Mode)

```bash
pnpm test:run
```

### Generate Coverage Report

```bash
pnpm test:coverage
```

---

## Test Structure

```
tests/
├── setup.ts                          # Global test setup
├── utils/
│   └── test-db.ts                    # Test database utilities
└── services/
    ├── billing-service.test.ts       # Billing services (14 tests)
    ├── product-service.test.ts       # Product services (23 tests)
    ├── customer-service.test.ts      # Customer tests (12 tests)
    └── license-service.test.ts       # License tests (12 tests)
├── unit/
    └── billing-math.test.ts          # Pure math tests (9 tests)
```

---

## Test Database

Tests use an **in-memory SQLite database** for fast, isolated testing.

### Features

- ✅ Fresh database for each test suite
- ✅ Automatic schema creation
- ✅ Seed data for common scenarios
- ✅ Reset between tests
- ✅ No file system pollution

### Usage

```typescript
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';

describe('MyService', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    seedTestData(db);
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should work', () => {
    // Test code
  });
});
```

---

## Test Coverage

### Current Coverage

| Component       | Tests | Coverage Goal |
| --------------- | ----- | ------------- |
| BillingService  | 14    | 90%+          |
| ProductService  | 23    | 90%+          |
| CustomerService | 12    | 90%+          |
| LicenseService  | 12    | 90%+          |
| BillingMath     | 9     | 100%          |

### View Coverage Report

```bash
pnpm test:coverage
```

Open `coverage/index.html` in browser to view detailed report.

---

## Writing Tests

### Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MyService } from '../../src/main/services/my-service';
import { createTestDatabase, resetTestDatabase, seedTestData } from '../utils/test-db';
import type Database from 'better-sqlite3';

describe('MyService - Feature Name', () => {
  let db: Database.Database;
  let myService: MyService;

  beforeEach(() => {
    db = createTestDatabase();
    seedTestData(db);
    myService = new MyService();
  });

  afterEach(() => {
    resetTestDatabase(db);
  });

  it('should do something', () => {
    const result = myService.doSomething();
    expect(result).toBe(expected);
  });

  it('should throw error on invalid input', () => {
    expect(() => {
      myService.doSomething(invalidInput);
    }).toThrow(ValidationError);
  });
});
```

---

## Test Categories

### 1. Billing Tests

**File:** `tests/services/billing-service.test.ts`

**Tests:**

- ✅ Line total calculations
- ✅ Bill total calculations
- ✅ Discount application
- ✅ Multiple GST rates
- ✅ Stock deduction
- ✅ Transaction rollback
- ✅ Customer balance updates

### 2. Product Tests

**File:** `tests/services/product-service.test.ts`

**Tests:**

- ✅ Product creation
- ✅ Input validation
- ✅ Duplicate prevention
- ✅ Stock adjustments
- ✅ Inventory logging
- ✅ Margin calculation

### 3. Customer Tests

**File:** `tests/services/customer-service.test.ts`

**Tests:**

- ✅ Customer creation
- ✅ Phone validation
- ✅ Balance management
- ✅ Search functionality
- ✅ Duplicate detection

### 4. License Tests

**File:** `tests/services/license-service.test.ts`

**Tests:**

- ✅ Trial license generation
- ✅ License activation
- ✅ Expiry validation
- ✅ Signature verification
- ✅ Machine fingerprint

---

## Best Practices

### 1. Isolated Tests

Each test should be independent and not rely on other tests.

```typescript
// ✅ GOOD
it('should create product', () => {
  const product = productService.addProduct({ name: 'Test' });
  expect(product.name).toBe('Test');
});

// ❌ BAD (relies on previous test)
it('should update product', () => {
  // Assumes product from previous test exists
  productService.updateProduct(1, { name: 'Updated' });
});
```

### 2. Clear Test Names

Use descriptive test names that explain what is being tested.

```typescript
// ✅ GOOD
it('should throw error when discount makes grand total negative', () => {
  // ...
});

// ❌ BAD
it('test discount', () => {
  // ...
});
```

### 3. Test Error Cases

Always test both success and error scenarios.

```typescript
it('should create product successfully', () => {
  // Test success case
});

it('should throw error for invalid input', () => {
  // Test error case
});
```

### 4. Use Seed Data

Use seed data for common test scenarios.

```typescript
beforeEach(() => {
  db = createTestDatabase();
  seedTestData(db); // Provides common products, customers
});
```

---

## Debugging Tests

### Run Single Test File

```bash
pnpm test billing-service
```

### Run Single Test

```bash
pnpm test -t "should calculate line totals correctly"
```

### Debug with UI

```bash
pnpm test:ui
```

Then click on individual tests to see details.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:run
      - run: pnpm test:coverage
```

---

## Summary

**Testing Stack:**

- ✅ Vitest - Test framework
- ✅ In-memory SQLite - Test database
- ✅ Coverage reports - V8 provider
- ✅ 70+ test cases - Comprehensive coverage
- ✅ Pure unit tests - For math and logic

**Run tests before committing code!**
