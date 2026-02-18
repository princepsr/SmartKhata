import React, { useState, useRef, useMemo } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { parseCSV, ParsedCSV } from '../../utils/csv-parser';
import { parsePDF } from '../../utils/pdf-parser';
import './BulkImportModal.css';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStage = 'UPLOAD' | 'MAP' | 'PREVIEW' | 'IMPORTING' | 'DONE';

interface ColumnMapping {
  name: string; // maps to CSV column index (string) or -1 if unmapped
  salePrice: string;
  purchasePrice: string;
  stockQty: string;
  sku: string;
  barcode: string;
  gstPercent: string;
  isActive: string;
  trackInventory: string;
}

const SYSTEM_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'name', label: 'Product Name', required: true },
  { key: 'salePrice', label: 'Sale Price', required: true },
  { key: 'purchasePrice', label: 'Purchase Price', required: false },
  { key: 'stockQty', label: 'Stock Quantity', required: false },
  { key: 'sku', label: 'SKU', required: false },
  { key: 'barcode', label: 'Barcode', required: false },
  { key: 'gstPercent', label: 'GST %', required: false },
  { key: 'isActive', label: 'Active Status (true/false/1/0)', required: false },
  { key: 'trackInventory', label: 'Track Inventory (true/false/1/0)', required: false },
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [stage, setStage] = useState<ImportStage>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    salePrice: '',
    purchasePrice: '',
    stockQty: '',
    sku: '',
    barcode: '',
    gstPercent: '',
    isActive: '',
    trackInventory: '',
  });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    execute: importProducts,
    loading,
    error: ipcError,
  } = useIPCMutation(IPC_CHANNELS.PRODUCT_IMPORT);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportErrors([]); // Clear previous errors

      try {
        let result: ParsedCSV;

        if (selectedFile.name.toLowerCase().endsWith('.pdf')) {
          // Parse PDF
          const rows = await parsePDF(selectedFile);
          if (rows.length === 0) {
            throw new Error('No text found in PDF');
          }
          // Convert 2D array to ParsedCSV structure
          // Assume first row is header if it looks like one, or just data
          // Simple heuristic: First row is header
          result = {
            headers: rows[0],
            data: rows.slice(1).map((r) => {
              // Map row array to object with numeric keys matching headers logic?
              // Wait, ParsedCSV usually expects specific structure?
              // csv-parser returns headers: string[], data: any[].
              // where data[i] is object with keys matching headers? Or just array?
              // Let's check csv-parser.ts. It returns { headers, data: any[] }.
              // Actually csv-parser usuall returns row objects keyed by header name.
              // But our BulkImportModal preview logic maps by INDEX (0, 1, 2) inside the object?
              // Let's look at BulkImportModal.tsx again.
              /*
                 previewData mapping:
                 const colIdx = parseInt(mapping[field.key]);
                 row[colIdx]
               */
              // It expects `row` to be an array-like object where row[0] gives column 0.
              // So `rows` from PDF can be used almost directly if we wrap it right.
              return r;
            }),
            totalRows: rows.length - 1,
          };
        } else {
          // Parse CSV
          result = await parseCSV(selectedFile);
        }

        setParsedData(result);
        setStage('MAP');

        // Auto-map columns if names match
        const newMapping = { ...mapping };
        result.headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

          if (['productname', 'name', 'item', 'description'].includes(lowerHeader)) {
            newMapping.name = index.toString();
          }
          if (['price', 'saleprice', 'mrp', 'rate'].includes(lowerHeader)) {
            newMapping.salePrice = index.toString();
          }
          if (['cost', 'purchaseprice', 'buyprice'].includes(lowerHeader)) {
            newMapping.purchasePrice = index.toString();
          }
          if (['stock', 'qty', 'quantity', 'inventory'].includes(lowerHeader)) {
            newMapping.stockQty = index.toString();
          }
          if (['sku', 'code', 'itemcode'].includes(lowerHeader)) {
            newMapping.sku = index.toString();
          }
          if (['barcode', 'ean', 'upc'].includes(lowerHeader)) {
            newMapping.barcode = index.toString();
          }
          if (['gst', 'tax', 'vat'].includes(lowerHeader)) {
            newMapping.gstPercent = index.toString();
          }
          if (['active', 'isactive', 'status'].includes(lowerHeader)) {
            newMapping.isActive = index.toString();
          }
          if (['trackinventory', 'track', 'inventorytracking'].includes(lowerHeader)) {
            newMapping.trackInventory = index.toString();
          }
        });
        setMapping(newMapping);
      } catch (err) {
        console.error('Parse error', err);
        setImportErrors(['Failed to parse file. Please ensure it is a valid CSV.']);
      }
    }
  };

  const mapField = (field: keyof ColumnMapping, columnIndex: string) => {
    setMapping((prev) => ({ ...prev, [field]: columnIndex }));
  };

  const previewData = useMemo(() => {
    if (!parsedData) {
      return [];
    }

    return parsedData.data.slice(0, 5).map((row, i) => {
      // Create a preview object based on mapping
      const previewRow: any = {};
      SYSTEM_FIELDS.forEach((field) => {
        const colIdx = parseInt(mapping[field.key]);
        if (!isNaN(colIdx) && row[colIdx] !== undefined) {
          previewRow[field.key] = row[colIdx];
        }
      });
      return previewRow;
    });
  }, [parsedData, mapping]);

  const validateAndImport = async () => {
    if (!parsedData) {
      return;
    }

    // transform all data
    const productsToImport = parsedData.data.map((row) => {
      const p: any = {};
      SYSTEM_FIELDS.forEach((field) => {
        const colIdx = parseInt(mapping[field.key]);
        if (!isNaN(colIdx) && row[colIdx] !== undefined) {
          let value: any = row[colIdx];

          // Convert Price fields (Rupees -> Paise)
          if (field.key === 'salePrice' || field.key === 'purchasePrice') {
            const floatVal = parseFloat(value);
            if (!isNaN(floatVal)) {
              value = Math.round(floatVal * 100);
            }
          }

          if (field.key === 'isActive' || field.key === 'trackInventory') {
            if (value !== undefined && value !== null && value !== '') {
              const strVal = String(value).toLowerCase().trim();
              value = strVal === 'true' || strVal === '1' || strVal === 'yes';
            } else if (field.key === 'trackInventory') {
              value = true; // Default track inventory to true
            } else if (field.key === 'isActive') {
              value = true; // Default active to true
            }
          }

          p[field.key] = value;
        }
      });
      return p;
    });

    // Simple validation
    const validProducts = productsToImport.filter((p) => p.name && p.salePrice);

    if (validProducts.length === 0) {
      setImportErrors(['No valid products found. Ensure Name and Sale Price are mapped.']);
      return;
    }

    try {
      setStage('IMPORTING');
      await importProducts(validProducts);
      setStage('DONE');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (e) {
      setStage('PREVIEW'); // Go back to preview on error
    }
  };

  const reset = () => {
    setFile(null);
    setParsedData(null);
    setStage('UPLOAD');
    setImportErrors([]);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content bulk-import-modal">
        <div className="modal-header">
          <h2>Bulk Import Products</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body import-body">
          <div className={stage === 'UPLOAD' ? 'import-upload-container' : 'import-scroll-area'}>
            {stage === 'UPLOAD' && (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <div className="upload-icon">📂</div>
                <p>Click to upload CSV or PDF or Drag & Drop</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt,.pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <p className="hint">Supported formats: CSV, PDF (Simple Tables)</p>
              </div>
            )}

            {stage === 'MAP' && parsedData && (
              <div className="mapping-zone">
                <p className="instruction">
                  Map columns from <strong>{file?.name}</strong> to System Fields
                </p>

                <div className="mapping-grid">
                  {SYSTEM_FIELDS.map((field) => (
                    <div key={field.key} className="mapping-row">
                      <label>
                        {field.label} {field.required && <span className="req">*</span>}
                      </label>
                      <select
                        value={mapping[field.key]}
                        onChange={(e) => mapField(field.key, e.target.value)}
                        className={!mapping[field.key] && field.required ? 'invalid' : ''}
                      >
                        <option value="">-- Ignore --</option>
                        {parsedData.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="preview-table-wrapper">
                  <h4>Preview (First 5 rows)</h4>
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {SYSTEM_FIELDS.map((f) => (
                          <th key={f.key}>{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i}>
                          {SYSTEM_FIELDS.map((f) => (
                            <td key={f.key}>{row[f.key] || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stage === 'IMPORTING' && (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Importing products...</p>
              </div>
            )}

            {stage === 'DONE' && (
              <div className="success-state">
                <div className="success-icon">✅</div>
                <p>Import Successful!</p>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="error-banner">
                {importErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
                {ipcError && <div>{ipcError}</div>}
                {loading && <div>Wait...</div>}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          {stage !== 'DONE' && stage !== 'IMPORTING' && (
            <button className="btn-secondary" onClick={stage === 'MAP' ? reset : onClose}>
              {stage === 'MAP' ? 'Back' : 'Cancel'}
            </button>
          )}

          {stage === 'MAP' && (
            <button className="btn-primary" onClick={validateAndImport}>
              Import Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
