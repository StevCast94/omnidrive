// ===== web/src/lib/api.ts =====
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15000,
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('od_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('od_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Typed helpers
export const auth = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => api.post('/auth/login', d),
  me: () => api.get('/auth/me'),
  updateMe: (d: any) => api.put('/auth/me', d),
  verifyIdentity: (fd: FormData) => api.post('/auth/verify-identity', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const vehicles = {
  list: (params?: any) => api.get('/vehicles', { params }),
  get: (id: string) => api.get(`/vehicles/${id}`),
  create: (d: any) => api.post('/vehicles', d),
  update: (id: string, d: any) => api.put(`/vehicles/${id}`, d),
  remove: (id: string) => api.delete(`/vehicles/${id}`),
  uploadPhotos: (id: string, fd: FormData) => api.post(`/vehicles/${id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  setAvailability: (id: string, available: boolean) => api.put(`/vehicles/${id}/availability`, { available }),
};

export const bookings = {
  list: (params?: any) => api.get('/bookings', { params }),
  get: (id: string) => api.get(`/bookings/${id}`),
  create: (d: any) => api.post('/bookings', d),
  confirm: (id: string, d?: any) => api.put(`/bookings/${id}/confirm`, d),
  cancel: (id: string) => api.put(`/bookings/${id}/cancel`),
  start: (id: string, pin?: string) => api.put(`/bookings/${id}/start`, { pin }),
  end: (id: string) => api.put(`/bookings/${id}/end`),
  uploadPhotosBefore: (id: string, fd: FormData) => api.put(`/bookings/${id}/photos-before`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPhotosAfter: (id: string, fd: FormData) => api.put(`/bookings/${id}/photos-after`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  dispute: (id: string, description: string) => api.post(`/bookings/${id}/dispute`, { description }),
};

export const payments = {
  wallet: () => api.get('/payments/wallet'),
  deposit: (d: any) => api.post('/payments/deposit', d),
  withdraw: (d: any) => api.post('/payments/withdraw', d),
  hold: (bookingId: string) => api.post(`/payments/hold/${bookingId}`),
  release: (bookingId: string) => api.post(`/payments/release/${bookingId}`),
  refund: (bookingId: string, amount?: number) => api.post(`/payments/refund/${bookingId}`, { amount }),
};

export const tracking = {
  report: (bookingId: string, d: any) => api.post(`/tracking/${bookingId}`, d),
  get: (bookingId: string) => api.get(`/tracking/${bookingId}`),
};

export const reviewsApi = {
  create: (d: any) => api.post('/reviews', d),
  byUser: (userId: string) => api.get(`/reviews/${userId}`),
};

export const subscriptions = {
  plans: () => api.get('/subscriptions'),
  subscribe: (d: any) => api.post('/subscriptions', d),
  cancel: () => api.put('/subscriptions/cancel'),
};


// ===== web/src/lib/store.ts =====
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
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
  token: string | null;
  setAuth: (user: User, token: string) => void;
  updateUser: (u: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('od_token', token);
        set({ user, token });
      },
      updateUser: u => set(s => ({ user: s.user ? { ...s.user, ...u } : null })),
      logout: () => {
        localStorage.removeItem('od_token');
        set({ user: null, token: null });
      },
    }),
    { name: 'omnidrive-auth', partialize: s => ({ user: s.user, token: s.token }) }
  )
);
