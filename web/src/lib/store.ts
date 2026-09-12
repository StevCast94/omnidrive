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
  gender?: string;
  birthDate?: string;
  documentType?: string;
  documentId?: string;
  identityVerified: boolean;
  verificationNotes?: string;
  selfieUrl?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  verifiedAt?: string;
  walletBalance: number;
  subscriptionTier: 'free' | 'premium' | 'elite';
  rating: number;
  totalTrips: number;
  avatarUrl?: string;
  countryCode?: string;
  walletCurrency?: string;
  emailVerifiedAt?: string;
  role: 'user' | 'verifier' | 'admin' | 'superadmin';
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
    // Solo se persiste el perfil. Los tokens los gestiona lib/session.ts.
    { name: 'omnidrive-user', partialize: s => ({ user: s.user }) }
  )
);


