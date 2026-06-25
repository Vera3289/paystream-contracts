export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UISlice {
  isLoading: boolean;
  modal: string | null;
  toast: Toast | null;
  setLoading: (isLoading: boolean) => void;
  showToast: (toast: Toast) => void;
}

export const createUISlice = (set: (fn: (state: UISlice) => void) => void): UISlice => ({
  isLoading: false,
  modal: null,
  toast: null,
  setLoading: (isLoading) =>
    set((state) => {
      state.isLoading = isLoading;
    }),
  showToast: (toast) =>
    set((state) => {
      state.toast = toast;
    }),
});
