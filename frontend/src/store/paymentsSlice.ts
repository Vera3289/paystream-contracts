export interface Payment {
  id: string;
  amount: number;
  token: string;
}

export interface PaymentsSlice {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  setPayments: (payments: Payment[]) => void;
}

export const createPaymentsSlice = (set: (fn: (state: PaymentsSlice) => void) => void): PaymentsSlice => ({
  payments: [],
  loading: false,
  error: null,
  setPayments: (payments) =>
    set((state) => {
      state.payments = payments;
    }),
});
