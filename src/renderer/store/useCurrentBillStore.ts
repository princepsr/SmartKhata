import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Current Bill Store
 * 
 * Manages the current active bill/sale in the POS.
 * This is temporary state that gets cleared after checkout.
 */

export interface BillItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface CurrentBill {
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerId?: number;
}

interface CurrentBillState {
  bill: CurrentBill;
  addItem: (item: Omit<BillItem, 'total'>) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  setDiscount: (discount: number) => void;
  setCustomer: (customerId: number | undefined) => void;
  clearBill: () => void;
  calculateTotals: () => void;
}

const emptyBill: CurrentBill = {
  items: [],
  subtotal: 0,
  tax: 0,
  discount: 0,
  total: 0,
};

export const useCurrentBillStore = create<CurrentBillState>()(
  devtools(
    (set, get) => ({
      bill: emptyBill,
      
      addItem: (item) =>
        set((state) => {
          const existingItem = state.bill.items.find(
            (i) => i.productId === item.productId
          );
          
          let newItems;
          if (existingItem) {
            // Update quantity if item already exists
            newItems = state.bill.items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity, total: (i.quantity + item.quantity) * i.price }
                : i
            );
          } else {
            // Add new item
            newItems = [...state.bill.items, { ...item, total: item.price * item.quantity }];
          }
          
          const newBill = { ...state.bill, items: newItems };
          get().calculateTotals();
          return { bill: newBill };
        }),
      
      removeItem: (productId) =>
        set((state) => {
          const newBill = {
            ...state.bill,
            items: state.bill.items.filter((i) => i.productId !== productId),
          };
          get().calculateTotals();
          return { bill: newBill };
        }),
      
      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            get().removeItem(productId);
            return state;
          }
          
          const newBill = {
            ...state.bill,
            items: state.bill.items.map((i) =>
              i.productId === productId
                ? { ...i, quantity, total: i.price * quantity }
                : i
            ),
          };
          get().calculateTotals();
          return { bill: newBill };
        }),
      
      setDiscount: (discount) =>
        set((state) => {
          const newBill = { ...state.bill, discount };
          get().calculateTotals();
          return { bill: newBill };
        }),
      
      setCustomer: (customerId) =>
        set((state) => ({
          bill: { ...state.bill, customerId },
        })),
      
      clearBill: () =>
        set({ bill: emptyBill }),
      
      calculateTotals: () =>
        set((state) => {
          const subtotal = state.bill.items.reduce((sum, item) => sum + item.total, 0);
          const tax = subtotal * 0.05; // 5% tax (placeholder)
          const total = subtotal + tax - state.bill.discount;
          
          return {
            bill: {
              ...state.bill,
              subtotal,
              tax,
              total: Math.max(0, total),
            },
          };
        }),
    }),
    { name: 'CurrentBill' }
  )
);
