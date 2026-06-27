export interface Merchant {
  id: string;
  name: string;
}

export interface MerchantsSlice {
  merchants: Merchant[];
  loading: boolean;
  error: string | null;
  setMerchants: (merchants: Merchant[]) => void;
}

export const createMerchantsSlice = (set: (fn: (state: MerchantsSlice) => void) => void): MerchantsSlice => ({
  merchants: [],
  loading: false,
  error: null,
  setMerchants: (merchants) =>
    set((state) => {
      state.merchants = merchants;
    }),
});
