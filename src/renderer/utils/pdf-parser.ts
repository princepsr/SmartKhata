// Heuristic PDF Parser
// Uses global pdfjsLib manually injected via index.html to avoid bundler/worker issues.

// Declare global types roughly
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const parsePDF = async (file: File): Promise<string[][]> => {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) {
    throw new Error('PDF.js library not loaded. Please restart the application.');
  }

  // Set worker source to local file
  // In production (Electron), this path should be relative to the html file
  // or absolute from root. 'libs/pdf.worker.min.js' works if index.html is in root of dist/renderer
  pdfjs.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const allRows: string[][] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // 1. Sort by Y descending (Top -> Bottom)
    // Tolerance for "same row" in PDF units
    const ROW_TOLERANCE = 5;

    // Structure: { y: number, cols: { x: number, str: string }[] }
    const rows: { y: number; cols: { x: number; str: string }[] }[] = [];

    // Sort items by Y descending first to process usually top-to-bottom
    // Note: PDF coordinate system usually has (0,0) at bottom-left, so higher Y is top.
    // However, pdfjs-dist might normalize. Let's assume standard PDF coordinates where higher Y is higher up?
    // Actually, in standard PDF, Y=0 is bottom.
    // But textContent often returns viewport coordinates.
    // We'll trust the sort.
    items.sort((a, b) => b.transform[5] - a.transform[5]);

    items.forEach((item) => {
      const y = item.transform[5];
      const x = item.transform[4];
      const str = item.str.trim();

      if (!str) return;

      // Find existing row within tolerance
      const existingRow = rows.find((r) => Math.abs(r.y - y) < ROW_TOLERANCE);

      if (existingRow) {
        existingRow.cols.push({ x, str });
      } else {
        rows.push({ y, cols: [{ x, str }] });
      }
    });

    // 2. Sort columns by X ascending
    rows.forEach((row) => {
      row.cols.sort((a, b) => a.x - b.x);
    });

    // 3. Sort rows by Y descending (Top to Bottom)
    // If Y=0 is bottom, then B > A means B is higher up (earlier on page).
    rows.sort((a, b) => b.y - a.y);

    // 4. Convert to string[][]
    const pageRows = rows.map((r) => r.cols.map((c) => c.str));

    // Filter out rows that look like just page numbers or noise (optional)
    // For now, keep everything.
    allRows.push(...pageRows);
  }

  return allRows;
};
