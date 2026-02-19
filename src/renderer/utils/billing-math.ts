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
export function calculateBillPreview(
  items: CartItem[],
  discountAmount: number = 0
): BillCalculation {
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
    const lineSubtotal = Math.round(product.salePrice * qty * 100) / 100;

    // Tax
    const lineGst = Math.round(((lineSubtotal * product.gstPercent) / 100) * 100) / 100;

    // Total
    const lineTotal = Math.round((lineSubtotal + lineGst) * 100) / 100;

    // Accumulate
    subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
    gstTotal = Math.round((gstTotal + lineGst) * 100) / 100;

    calculatedItems.push({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.salePrice,
      gstPercent: product.gstPercent,
      lineSubtotal,
      lineGst,
      lineTotal,
    });
  }

  // Final totals
  const grandTotal = Math.round((subtotal + gstTotal - discountAmount) * 100) / 100;

  return {
    items: calculatedItems,
    subtotal,
    gstTotal,
    discountAmount,
    grandTotal: Math.max(0, grandTotal), // Prevent negative total
  };
}

import { formatCurrency as standardFormatCurrency } from './formatters';

/**
 * Format currency (Rupees -> String)
 */
export const formatCurrency = standardFormatCurrency;

/**
 * Calculate Discrete Discount Amount
 *
 * @param type 'amount' or 'percent'
 * @param value The raw input value (e.g. "10" for 10% or 10 rupees)
 * @param subtotal Subtotal in rupees
 * @param gstTotal GST Total in rupees
 * @returns Discount amount in rupees
 */
export function calculateDiscountAmount(
  type: 'amount' | 'percent',
  value: string,
  subtotal: number,
  gstTotal: number
): number {
  const val = parseFloat(value) || 0;

  if (val <= 0) {
    return 0;
  }

  if (type === 'percent') {
    // Calculate percentage of Subtotal + GST
    const baseTotal = subtotal + gstTotal;
    return Math.round(((baseTotal * val) / 100) * 100) / 100;
  } else {
    // Fixed amount (Rupees)
    return val;
  }
}
