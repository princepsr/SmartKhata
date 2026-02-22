import { describe, it, expect } from 'vitest';
import { BaseRepository } from '../../src/main/repositories/base-repository';

// Concrete implementation for testing
class TestRepository extends BaseRepository {
  public testParseDate(dateStr: string) {
    return this.parseDate(dateStr);
  }
  public testFormatDateForSql(date: Date) {
    return this.formatDateForSql(date);
  }
}

describe('BaseRepository - Date Utilities (UTC Standardization)', () => {
  const repo = new TestRepository();

  describe('formatDateForSql', () => {
    it('should format date in UTC time', () => {
      // Create a date that is 4:30 PM IST (which is 11:00 AM UTC)
      const date = new Date('2026-02-22T16:30:45+05:30');
      const formatted = repo.testFormatDateForSql(date);

      // UTC should be 11:00:45
      expect(formatted).toBe('2026-02-22 11:00:45');
    });

    it('should pad single digits with zero in UTC', () => {
      // Jan 5, 2026, 09:05:02 UTC
      const date = new Date(Date.UTC(2026, 0, 5, 9, 5, 2));
      const formatted = repo.testFormatDateForSql(date);

      expect(formatted).toBe('2026-01-05 09:05:02');
    });
  });

  describe('parseDate', () => {
    it('should parse date string from SQLite as UTC correctly', () => {
      const dateStr = '2026-02-22 11:00:45';
      const parsed = repo.testParseDate(dateStr);

      // Since the repo appends 'Z', it should be treated as UTC
      expect(parsed.getUTCFullYear()).toBe(2026);
      expect(parsed.getUTCMonth()).toBe(1); // Feb
      expect(parsed.getUTCDate()).toBe(22);
      expect(parsed.getUTCHours()).toBe(11);
      expect(parsed.getUTCMinutes()).toBe(0);
      expect(parsed.getUTCSeconds()).toBe(45);
    });

    it('should preserve existing ISO strings with Z (UTC)', () => {
      const dateStr = '2026-02-22T16:30:45Z';
      const parsed = repo.testParseDate(dateStr);

      expect(parsed.getUTCHours()).toBe(16);
    });

    it('should handle empty strings', () => {
      const parsed = repo.testParseDate('');
      expect(parsed).toBeInstanceOf(Date);
    });
  });
});
