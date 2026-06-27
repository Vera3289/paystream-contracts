export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthSlice {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const createAuthSlice = (set: (fn: (state: AuthSlice) => void) => void): AuthSlice => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (user, token) =>
    set((state) => {
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
    }),
  logout: () =>
    set((state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    }),
});
