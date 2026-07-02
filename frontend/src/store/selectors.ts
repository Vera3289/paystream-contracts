import { StoreState } from './index';

export const selectUser = (state: StoreState) => state.user;
export const selectIsAuthenticated = (state: StoreState) => state.isAuthenticated;
export const selectMerchants = (state: StoreState) => state.merchants;
export const selectPayments = (state: StoreState) => state.payments;
export const selectUI = (state: StoreState) => ({
  isLoading: state.isLoading,
  modal: state.modal,
  toast: state.toast,
});
