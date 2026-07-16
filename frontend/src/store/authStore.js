import { create } from 'zustand';

// Access token lives in memory only; the refresh token is an httpOnly cookie
// managed by the backend. On a full reload, App bootstraps the session via
// POST /auth/refresh.
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  initialized: false,

  setSession: ({ user, accessToken }) => set({ user, accessToken }),
  setUser: (user) => set({ user }),
  clearSession: () => set({ user: null, accessToken: null }),
  setInitialized: () => set({ initialized: true }),
}));
