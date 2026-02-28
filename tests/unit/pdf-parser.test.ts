import { describe, it, expect } from 'vitest';
import {
  groupItemsIntoPhysicalRows,
  groupRowIntoColumns,
} from '../../src/renderer/utils/pdf-parser';

describe('PDF Parser Utility - Clustering Logic', () => {
  describe('groupItemsIntoPhysicalRows', () => {
    it('should group items with close Y coordinates into the same row', () => {
      const items = [
        { str: 'Hello', transform: [0, 0, 0, 0, 10, 100] },
        { str: 'World', transform: [0, 0, 0, 0, 50, 102] }, // Within 4px tolerance
        { str: 'Next', transform: [0, 0, 0, 0, 10, 80] }, // Different row
      ];

      const rows = groupItemsIntoPhysicalRows(items, 4);
      expect(rows.length).toBe(2);
      expect(rows[0].items.length).toBe(2); // Hello, World (Sorted by Y desc)
      expect(rows[1].items.length).toBe(1); // Next
    });

    it('should sort rows from top to bottom (descending Y in PDF coordinates)', () => {
      const items = [
        { str: 'Bottom', transform: [0, 0, 0, 0, 0, 10] },
        { str: 'Top', transform: [0, 0, 0, 0, 0, 100] },
      ];

      const rows = groupItemsIntoPhysicalRows(items);
      expect(rows[0].items[0].str).toBe('Top');
      expect(rows[1].items[0].str).toBe('Bottom');
    });
  });

  describe('groupRowIntoColumns', () => {
    it('should group items into columns based on X distance', () => {
      const rowItems = [
        { str: 'Col1', transform: [0, 0, 0, 0, 10, 100], width: 20 },
        { str: 'Part2', transform: [0, 0, 0, 0, 32, 100], width: 20 }, // Gap 2px < 10px
        { str: 'Col2', transform: [0, 0, 0, 0, 100, 100], width: 20 }, // Gap 48px > 10px
      ];

      const columns = groupRowIntoColumns(rowItems, 10);
      expect(columns.length).toBe(2);
      expect(columns[0]).toBe('Col1 Part2');
      expect(columns[1]).toBe('Col2');
    });

    it('should handle items out of order by sorting them internally', () => {
      const rowItems = [
        { str: 'Right', transform: [0, 0, 0, 0, 100, 100], width: 20 },
        { str: 'Left', transform: [0, 0, 0, 0, 10, 100], width: 20 },
      ];

      const columns = groupRowIntoColumns(rowItems);
      expect(columns).toEqual(['Left', 'Right']);
    });
  });
});
