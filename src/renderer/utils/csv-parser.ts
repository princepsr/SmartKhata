/**
 * Simple CSV Parser Utility
 * Handles basic CSV parsing with support for:
 * - Header detection
 * - Comma/Semicolon/Tab delimiters (auto-detect)
 * - Quoted values
 */

export interface ParsedCSV {
  headers: string[];
  data: string[][]; // Array of rows, each row is array of values
  totalRows: number;
}

export const parseCSV = async (file: File): Promise<ParsedCSV> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          resolve({ headers: [], data: [], totalRows: 0 });
          return;
        }

        // 1. Detect delimiter (naive)
        const firstLine = text.split('\n')[0];
        let delimiter = ',';
        if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
        if (firstLine.includes('\t')) delimiter = '\t';

        // 2. Split lines (handling quoted newlines is complex, using simple split for MVP)
        // For a robust implementation, we'd need a state machine or regex.
        // Let's use a slightly more robust regex split for lines
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

        if (lines.length === 0) {
          resolve({ headers: [], data: [], totalRows: 0 });
          return;
        }

        // 3. Parse Headers
        // Basic split by delimiter, handling quotes would need more logic
        const parseLine = (line: string) => {
          // This regex splits by delimiter but ignores delimiters inside quotes
          // It's a "good enough" regex for standard CSVs
          const regex = new RegExp(`(\\s*${delimiter}\\s*|\\r?\\n|\\r)`, 'g');
          // Actually, a simple split might fail on "Item, Name".
          // Let's use a proper simple parser function

          const row: string[] = [];
          let currentVal = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
              row.push(currentVal.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          // Push last value
          row.push(currentVal.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          return row;
        };

        const headers = parseLine(lines[0]);

        // 4. Parse Body
        const data = lines.slice(1).map((line) => parseLine(line));

        resolve({
          headers,
          data,
          totalRows: data.length,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};
