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
  gstEnabled: boolean = true,
  gstExclusiveMode: boolean = false
): BillCalculation {
  if (items.length === 0) {
    return {
      items: [],
      subtotal: 0,
      gstTotal: 0,
      discountAmount: 0,
      grandTotal: 0,
    };
  }

  // 1. Calculate Total Base Price (Sum of MRPs)
  let totalBasePrice = 0;
  items.forEach((item) => {
    totalBasePrice += item.product.salePrice * Math.max(0, item.quantity);
  });

  // 2. Proportional Discount Factor for the MRP
  const discountFactor =
    totalBasePrice > 0 ? Math.max(0, totalBasePrice - discountAmount) / totalBasePrice : 0;

  let finalSubtotal = 0;
  let finalGstTotal = 0;
  const calculatedItems: CalculatedLineItem[] = [];

  items.forEach((item) => {
    const qty = Math.max(0, item.quantity);
    const product = item.product;
    const isGstInclusive = gstExclusiveMode ? false : product.isGstInclusive;

    // The discount is applied to the Base Sale Price (MRP or Pre-tax Price)
    const discountedBasePrice = product.salePrice * qty * discountFactor;

    let lineSubtotal: number;
    let lineGst: number;
    let lineTotal: number;

    if (isGstInclusive) {
      // Inclusive: Discounted Base Price is the final inclusive price
      lineTotal = Math.round(discountedBasePrice * 100) / 100;
      if (gstEnabled && product.gstPercent > 0) {
        lineSubtotal = Math.round((lineTotal / (1 + product.gstPercent / 100)) * 100) / 100;
        lineGst = Math.round((lineTotal - lineSubtotal) * 100) / 100;
      } else {
        lineSubtotal = lineTotal;
        lineGst = 0;
      }
    } else {
      // Exclusive: Discounted Base Price is the taxable value
      lineSubtotal = Math.round(discountedBasePrice * 100) / 100;
      lineGst = gstEnabled
        ? Math.round(((lineSubtotal * product.gstPercent) / 100) * 100) / 100
        : 0;
      lineTotal = Math.round((lineSubtotal + lineGst) * 100) / 100;
    }

    finalSubtotal = Math.round((finalSubtotal + lineSubtotal) * 100) / 100;
    finalGstTotal = Math.round((finalGstTotal + lineGst) * 100) / 100;

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
  });

  const grandTotal = Math.round((finalSubtotal + finalGstTotal) * 100) / 100;

  return {
    items: calculatedItems,
    subtotal: finalSubtotal,
    gstTotal: finalGstTotal,
    discountAmount: Math.round(discountAmount * 100) / 100,
    grandTotal: Math.max(0, grandTotal),
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
  baseTotal: number
): number {
  const val = parseFloat(value) || 0;

  if (val <= 0) {
    return 0;
  }

  if (type === 'percent') {
    return Math.round(((baseTotal * val) / 100) * 100) / 100;
  } else {
    // Fixed amount (Rupees)
    return val;
  }
}
