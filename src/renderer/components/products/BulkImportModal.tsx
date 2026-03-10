import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { CreateProductRequest } from '@shared/validation/schemas';
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
  isGstInclusive: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();

  const SYSTEM_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = useMemo(
    () => [
      { key: 'name', label: t('inventory.form.name').replace(' *', ''), required: true },
      { key: 'salePrice', label: t('inventory.form.sale_price'), required: true },
      { key: 'purchasePrice', label: t('inventory.form.purchase_price'), required: false },
      { key: 'stockQty', label: t('inventory.form.opening_stock'), required: false },
      {
        key: 'sku',
        label: t('inventory.form.sku_optional').replace(' (Optional)', ''),
        required: false,
      },
      { key: 'barcode', label: t('common.barcode'), required: false },
      { key: 'gstPercent', label: t('inventory.form.gst_percent'), required: false },
      { key: 'isActive', label: t('inventory.form.active_product'), required: false },
      { key: 'trackInventory', label: t('inventory.form.track_inventory'), required: false },
      { key: 'isGstInclusive', label: t('inventory.form.gst_inclusive_mrp'), required: false },
    ],
    [t]
  );

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
    isGstInclusive: '',
  });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    execute: importProducts,
    loading,
    error: ipcError,
  } = useIPCMutation<CreateProductRequest[], boolean>(IPC_CHANNELS.PRODUCT_IMPORT);

  const { execute: parseExcelFile } = useIPCMutation<string, ParsedCSV>(
    IPC_CHANNELS.PRODUCT_PARSE_EXCEL
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportErrors([]); // Clear previous errors

      try {
        let result: ParsedCSV;

        if (selectedFile.name.toLowerCase().endsWith('.pdf')) {
          // Parse PDF with Progress support
          setStage('IMPORTING'); // Show loading early for PDF/OCR
          const rows = await parsePDF(selectedFile, (msg) => {
            setImportMessage(msg);
          });

          if (rows.length === 0) {
            throw new Error(t('inventory.import.errors.parse'));
          }
          result = {
            headers: rows[0],
            data: rows.slice(1),
            totalRows: rows.length - 1,
          };
        } else if (selectedFile.name.toLowerCase().match(/\.xlsx?$/)) {
          setStage('IMPORTING'); // Show loading for excel parsing
          const response = await parseExcelFile(selectedFile.path);
          if (!response) {
            throw new Error(t('inventory.import.errors.parse'));
          }
          result = response;
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

          if (['productname', 'name', 'item', 'description', 'particulars'].includes(lowerHeader)) {
            newMapping.name = index.toString();
          }
          if (['price', 'saleprice', 'mrp', 'rate', 'unitprice', 'val'].includes(lowerHeader)) {
            newMapping.salePrice = index.toString();
          }
          if (['cost', 'purchaseprice', 'buyprice', 'purrate'].includes(lowerHeader)) {
            newMapping.purchasePrice = index.toString();
          }
          if (['stock', 'qty', 'quantity', 'inventory', 'cnt', 'pcs'].includes(lowerHeader)) {
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
          if (['gstinclusive', 'mrp', 'inclusive'].includes(lowerHeader)) {
            newMapping.isGstInclusive = index.toString();
          }
        });
        setMapping(newMapping);
      } catch (err) {
        console.error('Parse error', err);
        setImportErrors([t('inventory.import.errors.parse')]);
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

    return parsedData.data.slice(0, 5).map((row) => {
      // Create a preview object based on mapping
      const previewRow: Record<string, string> = {};
      SYSTEM_FIELDS.forEach((field) => {
        const colIdx = parseInt(mapping[field.key]);
        if (!isNaN(colIdx) && row[colIdx] !== undefined) {
          previewRow[field.key] = row[colIdx];
        }
      });
      return previewRow;
    });
  }, [parsedData, mapping, SYSTEM_FIELDS]);

  const validateAndImport = async () => {
    if (!parsedData) {
      return;
    }

    // transform all data
    const productsToImport = parsedData.data.map((row) => {
      const p: Partial<CreateProductRequest> = {};
      SYSTEM_FIELDS.forEach((field) => {
        const colIdx = parseInt(mapping[field.key]);
        if (!isNaN(colIdx) && row[colIdx] !== undefined) {
          let value: string | number | boolean = row[colIdx];

          // Convert Price fields (Ensure valid number)
          if (field.key === 'salePrice' || field.key === 'purchasePrice') {
            const floatVal = parseFloat(value as string);
            if (!isNaN(floatVal)) {
              value = floatVal;
            }
          }

          if (
            field.key === 'isActive' ||
            field.key === 'trackInventory' ||
            field.key === 'isGstInclusive'
          ) {
            if (value !== undefined && value !== null && value !== '') {
              const strVal = String(value).toLowerCase().trim();
              value = strVal === 'true' || strVal === '1' || strVal === 'yes';
            } else if (field.key === 'isGstInclusive') {
              value = false; // Default inclusive to false
            } else {
              value = true; // Default others to true
            }
          }

          (p as Record<string, string | number | boolean | undefined>)[field.key] = value;
        }
      });
      return p as CreateProductRequest;
    });

    // Simple validation
    const validProducts = productsToImport.filter((p) => p.name && p.salePrice);

    if (validProducts.length === 0) {
      setImportErrors([t('inventory.import.errors.no_valid')]);
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
    } catch (err) {
      setStage('PREVIEW'); // Go back to preview on error
      console.error('Import failed', err);
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
          <h2>{t('inventory.import.title')}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body import-body">
          <div className={stage === 'UPLOAD' ? 'import-upload-container' : 'import-scroll-area'}>
            {stage === 'UPLOAD' && (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <div className="upload-icon">📂</div>
                <p>{t('inventory.import.upload_instruction')}</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt,.pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <p className="hint">{t('inventory.import.supported_formats')}</p>
              </div>
            )}

            {stage === 'MAP' && parsedData && (
              <div className="mapping-zone">
                <p className="instruction">
                  {t('inventory.import.map_instruction', { file: file?.name })}
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
                        <option value="">{t('inventory.import.ignore')}</option>
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
                  <h4>{t('inventory.import.preview_rows')}</h4>
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
                <p>{importMessage || t('inventory.import.processing')}</p>
              </div>
            )}

            {stage === 'DONE' && (
              <div className="success-state">
                <div className="success-icon">✅</div>
                <p>{t('inventory.import.success')}</p>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="error-banner">
                {importErrors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
                {ipcError && <div>{ipcError}</div>}
                {loading && <div>{t('common.processing')}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          {stage !== 'DONE' && stage !== 'IMPORTING' && (
            <button className="btn-secondary" onClick={stage === 'MAP' ? reset : onClose}>
              {stage === 'MAP' ? t('inventory.import.back') : t('common.cancel')}
            </button>
          )}

          {stage === 'MAP' && (
            <button className="btn-primary" onClick={validateAndImport}>
              {t('inventory.import.import_now')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
