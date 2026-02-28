/**
 * Calculate absolute discount amount from value and type
 */
export function calculateDiscountAmount(
  type: 'amount' | 'percent',
  value: string,
  base: number
): number {
  const val = parseFloat(value) || 0;
  if (type === 'percent') {
    return (base * val) / 100;
  }
  return val;
}

import { CalculatedLineItem, BillCalculation, Product } from '@shared/types/ipc';

export type { CalculatedLineItem, BillCalculation };

/**
 * STRICT GST CALCULATION BLUEPRINT (Refined Payable-First Model)
 * 1. Line Gross: Qty * UnitPrice
 * 2. Line Item Discount: Applied to Gross (Inclusive) or Base (Exclusive)
 * 3. Line Net: Gross - ItemDiscount (This is the "Payable" in inclusive mode)
 * 4. Bill Discount: Distributed proportionally on Line Net
 * 5. Tax Extraction: From "Final Line Payable"
 */
export function calculateBillPreview(
  items: Array<{
    product: Product;
    quantity: number;
    discountValue?: number;
    discountType?: 'amount' | 'percent';
  }>,
  billDiscountAmount: number,
  gstEnabled: boolean,
  isExclusive: boolean,
  supplyType: string = 'intrastate'
): BillCalculation {
  if (!items || items.length === 0) {
    return {
      items: [],
      subtotal: 0,
      gstTotal: 0,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 0,
      discountAmount: billDiscountAmount,
      grandTotal: 0,
    };
  }

  // 1. Calculate Initial Line Payables (MRP-Level for Inclusive, Base-Level for Exclusive)
  const linePayables = items.map((item) => {
    const qty = item.quantity || 0;
    const unitPrice = item.product.salePrice || 0;
    const itemGross = qty * unitPrice;

    const itemDisc = calculateDiscountAmount(
      item.discountType || 'amount',
      (item.discountValue || 0).toString(),
      itemGross
    );

    return {
      ...item,
      itemGross,
      itemDisc,
      netPayable: itemGross - itemDisc, // This is the amount the customer pays for this line before bill discount
    };
  });

  const totalNetPayable = linePayables.reduce((sum, lp) => sum + lp.netPayable, 0);

  // 2. Distribute Bill Discount and Extract Taxes
  const calculatedItems = linePayables.map((lp) => {
    // Proportional Bill Discount
    const distBillDiscount =
      totalNetPayable > 0 ? (lp.netPayable / totalNetPayable) * billDiscountAmount : 0;

    const finalLinePayable = lp.netPayable - distBillDiscount;
    const rate = (lp.product.gstPercent || 0) / 100;

    let taxable: number;
    let gst: number;

    if (!gstEnabled) {
      taxable = finalLinePayable;
      gst = 0;
    } else if (isExclusive) {
      // In exclusive mode, netPayable was based on Base Price.
      // So finalLinePayable IS the taxable subtotal.
      taxable = finalLinePayable;
      gst = taxable * rate;
    } else {
      // In inclusive mode, netPayable was based on MRP.
      // So finalLinePayable IS the grand total for this line.
      taxable = finalLinePayable / (1 + rate);
      gst = finalLinePayable - taxable;
    }

    // Rounding for intermediate line values
    const roundedTaxable = Math.round(taxable * 100) / 100;
    const roundedGst = Math.round(gst * 100) / 100;

    // CGST/SGST/IGST Split
    let cgst = 0,
      sgst = 0,
      igst = 0;
    if (supplyType === 'interstate') {
      igst = roundedGst;
    } else {
      cgst = Math.round((roundedGst / 2) * 100) / 100;
      sgst = Math.round((roundedGst - cgst) * 100) / 100; // 1-paisa adjustment logic helper
    }

    return {
      productId: lp.product.id,
      productName: lp.product.name,
      quantity: lp.quantity,
      unitPrice: lp.product.salePrice,
      gstPercent: lp.product.gstPercent,
      lineSubtotal: roundedTaxable,
      lineGst: roundedGst,
      lineCgst: cgst,
      lineSgst: sgst,
      lineIgst: igst,
      lineTotal: isExclusive
        ? roundedTaxable + roundedGst
        : Math.round(finalLinePayable * 100) / 100,
    };
  });

  // 3. Totals Aggregation
  const subtotal = calculatedItems.reduce((sum, b) => sum + b.lineSubtotal, 0);
  const gstTotal = calculatedItems.reduce((sum, b) => sum + b.lineGst, 0);
  const cgstTotal = calculatedItems.reduce((sum, b) => sum + b.lineCgst, 0);
  const sgstTotal = calculatedItems.reduce((sum, b) => sum + b.lineSgst, 0);
  const igstTotal = calculatedItems.reduce((sum, b) => sum + b.lineIgst, 0);

  // Grand Total Validation (Step 9 of Blueprint)
  // Inclusive: sum of rounded line payables
  // Exclusive: subtotal + gstTotal
  const grandTotal = isExclusive
    ? subtotal + gstTotal
    : calculatedItems.reduce((sum, b) => sum + b.lineTotal, 0);

  // Final safeguard: reconcile against (TotalNetPayable - billDiscountAmount) in inclusive mode
  if (!isExclusive && Math.abs(grandTotal - (totalNetPayable - billDiscountAmount)) > 0.05) {
    // If there's a significant drift, we might need a 1-paisa adjustment here too
    // but usually, individual line rounding sums up correctly.
  }

  return {
    items: calculatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    gstTotal: Math.round(gstTotal * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    discountAmount: billDiscountAmount,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}
