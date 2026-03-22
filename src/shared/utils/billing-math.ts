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
      totalItemDiscount: 0,
      totalBillDiscount: 0,
      totalDiscount: 0,
      discountAmount: billDiscountAmount,
      grandTotal: 0,
    };
  }

  // 1. Calculate Initial Line Payables (MRP-Level for Inclusive, Base-Level for Exclusive)
  const linePayables = items.map((item) => {
    let qty = item.quantity || 0;
    const isWeight = item.product.isWeightBased || item.product.uom?.toLowerCase() === 'kg';
    if (isWeight) {
      qty = Math.round(qty * 1000) / 1000;
    }
    const unitPrice = item.product.salePrice || 0;
    const itemGross = qty * unitPrice;

    const itemDisc = calculateDiscountAmount(
      item.discountType || 'amount',
      (item.discountValue || 0).toString(),
      itemGross
    );

    return {
      ...item,
      quantity: qty,
      itemGross,
      itemDisc,
      netPayable: itemGross - itemDisc, // This is the amount the customer pays for this line before bill discount
    };
  });

  const totalItemDiscount = linePayables.reduce((sum, lp) => sum + lp.itemDisc, 0);
  const totalGrossPayable = linePayables.reduce((sum, lp) => sum + lp.itemGross, 0);

  // 2. Distribute Bill Discount and Extract Taxes
  const calculatedItems = linePayables.map((lp) => {
    // Proportional Bill Discount (Weighted by Gross for additive behavior)
    const distBillDiscount =
      totalGrossPayable > 0 ? (lp.itemGross / totalGrossPayable) * billDiscountAmount : 0;

    const finalLinePayable = lp.netPayable - distBillDiscount;
    const rate = (lp.product.gstPercent || 0) / 100;

    let taxable: number;
    let gst: number;

    if (!gstEnabled) {
      taxable = finalLinePayable;
      gst = 0;
    } else if (isExclusive) {
      taxable = finalLinePayable;
      gst = taxable * rate;
    } else {
      taxable = finalLinePayable / (1 + rate);
      gst = finalLinePayable - taxable;
    }

    const roundedTaxable = Math.round(taxable * 100) / 100;
    const roundedGst = Math.round(gst * 100) / 100;

    let cgst = 0,
      sgst = 0,
      igst = 0;
    if (supplyType === 'interstate') {
      igst = roundedGst;
    } else {
      cgst = Math.round((roundedGst / 2) * 100) / 100;
      sgst = Math.round((roundedGst - cgst) * 100) / 100;
    }

    return {
      productId: lp.product.id,
      productName: lp.product.name,
      quantity: lp.quantity,
      unitPrice: lp.product.salePrice,
      discountValue: lp.discountValue,
      discountType: lp.discountType,
      itemDiscount: Math.round(lp.itemDisc * 100) / 100,
      gstPercent: lp.product.gstPercent,
      lineSubtotal: roundedTaxable,
      lineGst: roundedGst,
      lineCgst: cgst,
      lineSgst: sgst,
      lineIgst: igst,
      lineTotal: isExclusive
        ? roundedTaxable + roundedGst
        : Math.round(finalLinePayable * 100) / 100,
      uom: lp.product.uom,
    };
  });

  const subtotal = calculatedItems.reduce((sum, b) => sum + b.lineSubtotal, 0);
  const gstTotal = calculatedItems.reduce((sum, b) => sum + b.lineGst, 0);
  const cgstTotal = calculatedItems.reduce((sum, b) => sum + b.lineCgst, 0);
  const sgstTotal = calculatedItems.reduce((sum, b) => sum + b.lineSgst, 0);
  const igstTotal = calculatedItems.reduce((sum, b) => sum + b.lineIgst, 0);

  const grandTotal = isExclusive
    ? subtotal + gstTotal
    : calculatedItems.reduce((sum, b) => sum + b.lineTotal, 0);

  const totalDiscount = totalItemDiscount + billDiscountAmount;

  return {
    items: calculatedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    gstTotal: Math.round(gstTotal * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    totalItemDiscount: Math.round(totalItemDiscount * 100) / 100,
    totalBillDiscount: Math.round(billDiscountAmount * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    discountAmount: Math.round(totalDiscount * 100) / 100, // For backward compatibility
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}
