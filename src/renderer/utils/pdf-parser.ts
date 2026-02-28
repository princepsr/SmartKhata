import { createWorker } from 'tesseract.js';

// Declare global types for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

/**
 * Group physical items into rows based on Y coordinate
 */
export const groupItemsIntoPhysicalRows = (
  items: any[],
  tolerance: number = 4
): { y: number; items: any[] }[] => {
  const physicalRows: { y: number; items: any[] }[] = [];

  items.forEach((item) => {
    const y = item.transform[5];
    const existingRow = physicalRows.find((r) => Math.abs(r.y - y) <= tolerance);
    if (existingRow) {
      existingRow.items.push(item);
    } else {
      physicalRows.push({ y, items: [item] });
    }
  });

  return physicalRows.sort((a, b) => b.y - a.y);
};

/**
 * Group row items into columns based on X coordinate
 */
export const groupRowIntoColumns = (items: any[], colTolerance: number = 10): string[] => {
  const sortedItems = [...items].sort((a, b) => a.transform[4] - b.transform[4]);
  const cells: string[] = [];
  let currentCell = '';
  let lastX = -1;

  sortedItems.forEach((item) => {
    const x = item.transform[4];
    if (lastX !== -1 && x - lastX > colTolerance) {
      cells.push(currentCell.trim());
      currentCell = item.str;
    } else {
      currentCell += (currentCell ? ' ' : '') + item.str;
    }
    lastX = x + (item.width || 0);
  });
  cells.push(currentCell.trim());
  return cells.filter((span) => span.length > 0);
};

/**
 * Robust PDF Parser with X,Y clustering and OCR fallback
 */
export const parsePDF = async (
  file: File,
  onProgress?: (msg: string) => void
): Promise<string[][]> => {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) {
    throw new Error('PDF.js library not loaded.');
  }

  pdfjs.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

  onProgress?.('Reading PDF structure...');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const allRows: string[][] = [];

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`Processing Page ${i}/${numPages}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    if (items.length === 0) {
      onProgress?.(`No text found on Page ${i}. Initializing OCR...`);
      const ocrRows = await performOCR(page, onProgress);
      allRows.push(...ocrRows);
      continue;
    }

    // Use refactored clustering logic
    const physicalRows = groupItemsIntoPhysicalRows(items);
    const pageRows = physicalRows.map((row) => groupRowIntoColumns(row.items));

    allRows.push(...pageRows);
  }

  return allRows.filter((row) => row.length > 0);
};

/**
 * OCR Fallback using Tesseract.js (Offline compatible)
 */
async function performOCR(page: any, onProgress?: (msg: string) => void): Promise<string[][]> {
  // 1. Render page to canvas
  const viewport = page.getViewport({ scale: 2.0 }); // Upscale for better OCR
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (!context) {
    throw new Error('Could not create canvas context');
  }

  await page.render({ canvasContext: context, viewport }).promise;

  // 2. Initialize Tesseract Worker
  // Note: We use local assets for fully offline mode
  const worker = await createWorker('eng', 1, {
    workerPath: 'libs/tesseract.worker.min.js',
    corePath: 'libs/tesseract-core.wasm.js',
    langPath: 'assets/tesseract-data',
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  const { data } = await worker.recognize(canvas);
  await worker.terminate();

  // 3. Convert Tesseract lines to string[][]
  // Tesseract gives us lines and word positions.
  // We'll use lines as a starting point.
  const rows: string[][] = data.lines.map((line) => {
    // Split line into words, but try to keep columns together
    // Heuristic: if gap between words is large, it's a new column
    const cells: string[] = [];
    let currentCell = '';

    line.words.forEach((word, idx) => {
      if (idx > 0) {
        const prevWord = line.words[idx - 1];
        const gap = word.bbox.x0 - prevWord.bbox.x1;
        if (gap > 20) {
          // Large gap = new column
          cells.push(currentCell.trim());
          currentCell = word.text;
        } else {
          currentCell += ' ' + word.text;
        }
      } else {
        currentCell = word.text;
      }
    });

    cells.push(currentCell.trim());
    return cells.filter((c) => c.length > 0);
  });

  return rows.filter((r) => r.length > 0);
}
