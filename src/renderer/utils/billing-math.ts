import type { Product } from '@shared/types/ipc';

export interface CalculatedLineItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
}

export interface BillCalculation {
  items: CalculatedLineItem[];
  subtotal: number;
  gstTotal: number;
  discountAmount: number;
  grandTotal: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

/**
 * Calculate Bill Preview (Client-Side)
 * 
 * Mirrors the logic in BillingTransactionService for instant UI feedback.
 * NOTE: This is a PREVIEW only. Final calculations are always done by the backend.
 * 
 * Logic:
 * - Sale Price is treated as BASE price (Exclusive of Tax) based on service implementation.
 * - Subtotal = Sum(Base Price * Qty)
 * - GST = Sum(Subtotal * GST%)
 * - Grand Total = Subtotal + GST - Discount
 */
export function calculateBillPreview(items: CartItem[], discountAmount: number = 0): BillCalculation {
  let subtotal = 0;
  let gstTotal = 0;
  const calculatedItems: CalculatedLineItem[] = [];

  for (const item of items) {
    const { product, quantity } = item;

    // Line calculations
    // Ensure we handle floating point precision by keeping everything in integers (cents/paisa) if possible, 
    // or strictly following the service logic which seems to use raw numbers but Javascript math.
    // Service uses: lineSubtotal = product.salePrice * item.quantity;
    // We should probably safeguard against NaN or negative inputs.
    
    const qty = Math.max(0, quantity);
    const lineSubtotal = product.salePrice * qty; // salePrice is in paisa (integer)? or float? 
    // Types say 'number'. Usually DB stores integers for money. 
    // If salePrice is 10000 (100.00), then lineSubtotal is 20000.
    
    // Tax
    const lineGst = (lineSubtotal * product.gstPercent) / 100;
    
    // Total
    const lineTotal = lineSubtotal + lineGst;

    // Accumulate
    subtotal += lineSubtotal;
    gstTotal += lineGst;

    calculatedItems.push({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.salePrice,
      gstPercent: product.gstPercent,
      lineSubtotal,
      lineGst,
      lineTotal
    });
  }

  // Final totals
  const grandTotal = subtotal + gstTotal - discountAmount;

  return {
    items: calculatedItems,
    subtotal,
    gstTotal,
    discountAmount,
    grandTotal: Math.max(0, grandTotal) // Prevent negative total
  };
}

/**
 * Format currency (Paisa -> Rupee)
 * @param amountInPaisa Amount in paisa (integer)
 * @returns Formatted string (e.g. "100.00")
 */
export function formatCurrency(amountInPaisa: number): string {
  return (amountInPaisa / 100).toFixed(2);
}
