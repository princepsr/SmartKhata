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

describe('BaseRepository - Date Utilities (IST/Local Time)', () => {
  const repo = new TestRepository();

  describe('formatDateForSql', () => {
    it('should format date in local time (IST)', () => {
      // Create a specific local date
      const date = new Date(2026, 1, 22, 16, 30, 45); // Feb 22, 2026, 16:30:45
      const formatted = repo.testFormatDateForSql(date);

      expect(formatted).toBe('2026-02-22 16:30:45');
    });

    it('should pad single digits with zero', () => {
      const date = new Date(2026, 0, 5, 9, 5, 2); // Jan 5, 2026, 09:05:02
      const formatted = repo.testFormatDateForSql(date);

      expect(formatted).toBe('2026-01-05 09:05:02');
    });
  });

  describe('parseDate', () => {
    it('should parse local date string from SQLite correctly', () => {
      const dateStr = '2026-02-22 16:30:45';
      const parsed = repo.testParseDate(dateStr);

      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(1); // Feb
      expect(parsed.getDate()).toBe(22);
      expect(parsed.getHours()).toBe(16);
      expect(parsed.getMinutes()).toBe(30);
      expect(parsed.getSeconds()).toBe(45);
    });

    it('should preserve existing ISO strings with Z (UTC)', () => {
      const dateStr = '2026-02-22T16:30:45Z';
      const parsed = repo.testParseDate(dateStr);

      // When parsed with Z, it should be the same UTC instant
      expect(parsed.getUTCHours()).toBe(16);
    });

    it('should handle empty strings', () => {
      const parsed = repo.testParseDate('');
      expect(parsed).toBeInstanceOf(Date);
    });
  });
});
