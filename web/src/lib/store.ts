import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OmniUser {
  id: string;
  email: string;
  phone: string;
  name: string;
  lastName: string;
  documentType?: string;
  documentId?: string;
  birthDate?: string;
  gender?: string;
  identityVerified: boolean;
  selfieUrl?: string;
  walletBalance: number;
  subscriptionTier: 'free' | 'premium' | 'elite';
  subscriptionEnds?: string;
  driverScore: number;
  totalTrips: number;
  totalKm: number;
  role: 'user' | 'admin';
  createdAt: string;
}

interface AuthStore {
  user: OmniUser | null;
  setUser: (user: OmniUser) => void;
  updateUser: (u: Partial<OmniUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      user: null,
      setUser: user => {
        localStorage.setItem('od_user', JSON.stringify(user));
        set({ user });
      },
      updateUser: u =>
        set(s => {
          const merged = s.user ? { ...s.user, ...u } : null;
          if (merged) localStorage.setItem('od_user', JSON.stringify(merged));
          return { user: merged };
        }),
      logout: async () => {
        // Import supabase dynamically to sign out from Supabase Auth too
        const { supabase } = await import('./supabase');
        await supabase.auth.signOut();
        localStorage.removeItem('od_user');
        set({ user: null });
      },
    }),
    {
      name: 'omnidrive-auth',
      partialize: s => ({ user: s.user }),
    }
  )
);
