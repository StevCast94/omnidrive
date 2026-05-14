// ===== web/src/lib/api.ts =====
import axios from 'axios';
import { getAccessToken } from './supabase';

export const api = axios.create({
  baseURL: "https://omnidrive-production.up.railway.app/api",
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  transformRequest: [(data) => {
    if (typeof data === 'object' && !(data instanceof FormData)) {
      return JSON.stringify(data);
    }
    return data;
  }],
});

// Attach Supabase access token to every request
api.interceptors.request.use(async cfg => {
  const token = await getAccessToken();
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  // Force content-type for JSON bodies
  if (cfg.data && typeof cfg.data === 'string' && cfg.data.startsWith('{')) {
    cfg.headers['Content-Type'] = 'application/json';
  }
  return cfg;
});

api.interceptors.response.use(
  r => r,
  async err => {
    // Token expired — Supabase auto-refreshes; retry once
    if (err.response?.status === 401) {
      const { supabase } = await import('./supabase');
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        err.config.headers.Authorization = `Bearer ${session.access_token}`;
        return axios(err.config);
      }
      // Refresh failed — redirect to login
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
  verificarCedula: (documentId: string) => api.post('/auth/verificar-cedula', { documentId }),
  verificarWhatsApp: (phone: string) => api.post('/auth/verificar-whatsapp', { phone }),
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

export const adminApi = {
  bannedIdentities: (p?: any) => api.get('/admin/banned-identities', { params: p }),
  banIdentity: (d: { documentId: string; reason: string }) => api.post('/admin/banned-identities', d),
  unbanIdentity: (id: string) => api.delete(`/admin/banned-identities/${id}`),
  verifyCedula: (documentId: string) => api.post('/admin/verify-cedula', { documentId }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
};


