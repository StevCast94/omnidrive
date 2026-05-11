// ===== web/src/lib/store.ts =====
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  authId: string;
  email: string;
  phone: string;
  name: string;
  lastName: string;
  identityVerified: boolean;
  walletBalance: number;
  subscriptionTier: 'free' | 'premium' | 'elite';
  driverScore: number;
  totalTrips: number;
  role: 'user' | 'admin';
}

interface AuthStore {
  user: User | null;
  setUser:    (u: User) => void;
  updateUser: (u: Partial<User>) => void;
  clearUser:  () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      user: null,
      setUser:    user => set({ user }),
      updateUser: u    => set(s => ({ user: s.user ? { ...s.user, ...u } : null })),
      clearUser:  ()   => set({ user: null }),
    }),
    // Only persist the user profile — token lives in Supabase session (localStorage managed by SDK)
    { name: 'omnidrive-user', partialize: s => ({ user: s.user }) }
  )
);

