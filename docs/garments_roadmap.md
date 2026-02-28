# 👕 Garments Store Roadmap (Future Release)

This document outlines the specialized features required to transform SmartKhata into a market leader for Garment/Clothing retail shops.

## 1. Multi-Variant Management (High Priority)

Garments are rarely sold as single SKUs. One design (e.g., "Cotton T-Shirt") spans multiple sizes and colors.

- [ ] **Matrix Grid Entry**: A UI to add multiple variants at once (e.g., ticking S, M, L, XL for three colors).
- [ ] **Variant Grouping**: Link items with the same `variant_group_id` to show "Other Sizes/Colors" on the billing screen.
- [ ] **SKU Generation**: Automatic SKU/Barcode generation for variants (e.g., `TSHIRT-RED-L`).

## 2. Advanced Barcode Support

- [ ] **Tag Designer**: Lightweight PDF generator to print 2-inch price tags with Price, Size, and Barcode.
- [ ] **Batch Printing**: Print tags for 50 items at once from a Purchase invoice.

## 3. Inventory Aging & Dead Stock

Garments get "stale" after 2-3 months.

- [ ] **Aging Report**: Identify stock that hasn't moved for 30/60/90 days.
- [ ] **Clearance Mode**: Bulk apply discounts to aged stock (e.g., "40% off on all stock > 90 days").

## 4. seasonal Promotions

- [ ] **Buy-X-Get-Y logic**: Support for "Buy 2 Get 1 Free" or "Buy for ₹2000, Get ₹200 back".
- [ ] **Campaign Management**: Schedule discounts that start and end on specific dates (e.g., Diwali Sale).

## 5. Visual Catalog (Gallery)

- [ ] **Item Images**: Attach a photo to a variant group so the shopkeeper can confirm the design on screen.
- [ ] **Tablet Catalog**: A "lookbook" mode for shops to show customers designs on a screen before fetching them from the rack.
