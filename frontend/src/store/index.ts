import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createAuthSlice, AuthSlice } from './authSlice';
import { createMerchantsSlice, MerchantsSlice } from './merchantsSlice';
import { createPaymentsSlice, PaymentsSlice } from './paymentsSlice';
import { createUISlice, UISlice } from './uiSlice';

export type StoreState = AuthSlice & MerchantsSlice & PaymentsSlice & UISlice;

export const useStore = create<StoreState>()(
  immer((set) => ({
    ...createAuthSlice(set),
    ...createMerchantsSlice(set),
    ...createPaymentsSlice(set),
    ...createUISlice(set),
  }))
);
