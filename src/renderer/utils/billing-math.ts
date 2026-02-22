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
  discountAmount: number = 0,
  gstEnabled: boolean = true
): BillCalculation {
  let subtotal = 0;
  let gstTotal = 0;
  const calculatedItems: CalculatedLineItem[] = [];

  for (const item of items) {
    const { product, quantity } = item;
    const qty = Math.max(0, quantity);

    // Line calculations
    let lineSubtotal: number;
    let lineGst: number;
    let lineTotal: number;

    if (product.isGstInclusive) {
      // Price is inclusive: Total = Price * Qty, Subtotal = Total / (1 + GST%)
      lineTotal = Math.round(product.salePrice * qty * 100) / 100;
      if (gstEnabled && product.gstPercent > 0) {
        lineSubtotal = Math.round((lineTotal / (1 + product.gstPercent / 100)) * 100) / 100;
        lineGst = Math.round((lineTotal - lineSubtotal) * 100) / 100;
      } else {
        lineSubtotal = lineTotal;
        lineGst = 0;
      }
    } else {
      // Price is exclusive: Subtotal = Price * Qty, Total = Subtotal * (1 + GST%)
      lineSubtotal = Math.round(product.salePrice * qty * 100) / 100;
      lineGst = gstEnabled
        ? Math.round(((lineSubtotal * product.gstPercent) / 100) * 100) / 100
        : 0;
      lineTotal = Math.round((lineSubtotal + lineGst) * 100) / 100;
    }

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
  const totalWithTax = Math.round((subtotal + gstTotal) * 100) / 100;
  const grandTotal = Math.round((totalWithTax - discountAmount) * 100) / 100;

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
