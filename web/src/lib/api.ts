// ===== web/src/lib/api.ts =====
import axios from 'axios';
import { getAccessToken, renovarSesion, borrarSesion } from './session';

// Use same-origin /api in production (Railway), explicit URL for local dev
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  transformRequest: [(data) => {
    if (typeof data === 'object' && !(data instanceof FormData)) {
      return JSON.stringify(data);
    }
    return data;
  }],
});

// El access token propio viaja en cada peticion.
api.interceptors.request.use(cfg => {
  const token = getAccessToken();
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
    const original = err.config;

    // 401: el access token dura 15 minutos. Se renueva una vez y se reintenta.
    // La marca _reintentado evita el bucle si la renovacion tambien da 401.
    if (err.response?.status === 401 && original && !original._reintentado) {
      original._reintentado = true;

      const nuevo = await renovarSesion(API_BASE);
      if (nuevo) {
        original.headers.Authorization = `Bearer ${nuevo}`;
        return api(original);
      }

      borrarSesion();
      // Recarga completa a proposito: la sesion caduco, y empezar de cero
      // deja la aplicacion sin restos del usuario anterior.
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

// Typed helpers
export const auth = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => api.post('/auth/login', d),
  google: (idToken: string) => api.post('/auth/google', { idToken }),
  logout: (refreshToken: string | null, todas = false) => api.post('/auth/logout', { refreshToken, todas }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (actual: string, nueva: string) => api.post('/auth/change-password', { actual, nueva }),
  me: () => api.get('/auth/me'),
  updateMe: (d: any) => api.put('/auth/me', d),
  verifyIdentity: (fd: FormData) => api.post('/auth/verify-identity', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  verificarCedula: (documentId: string, documentType?: string) =>
    api.post('/auth/verificar-cedula', { documentId, documentType }),
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
  // El desglose lo calcula el servidor: el front no vuelve a tener su propia
  // formula de precios.
  cotizar: (d: { vehicleId: string; startAt: string; endAt: string; withDriver?: boolean }) =>
    api.post('/bookings/cotizar', d),
  confirm: (id: string, d?: any) => api.put(`/bookings/${id}/confirm`, d),
  cancel: (id: string) => api.put(`/bookings/${id}/cancel`),
  start: (id: string) => api.put(`/bookings/${id}/start`),
  end: (id: string) => api.put(`/bookings/${id}/end`),
  uploadPhotosBefore: (id: string, fd: FormData) => api.put(`/bookings/${id}/photos-before`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadPhotosAfter: (id: string, fd: FormData) => api.put(`/bookings/${id}/photos-after`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  dispute: (id: string, description: string) => api.post(`/bookings/${id}/dispute`, { description }),
  politicaCancelacion: (id: string) => api.get(`/bookings/${id}/politica-cancelacion`),
};

export const tracking = {
  get: (bookingId: string) => api.get(`/tracking/${bookingId}`),
  // Se envian por lotes: el movil acumula puntos sin cobertura y los manda
  // juntos al recuperarla.
  reportarLote: (bookingId: string, puntos: any[]) => api.post(`/tracking/${bookingId}`, { puntos }),
  consentimiento: (bookingId: string, activar: boolean) =>
    api.post(`/tracking/${bookingId}/consentimiento`, { activar }),
  geocerca: (bookingId: string, d: { lat?: number; lng?: number; radioKm?: number; quitar?: boolean }) =>
    api.put(`/tracking/${bookingId}/geocerca`, d),
};

export const reviewsApi = {
  create: (d: any) => api.post('/reviews', d),
  byUser: (userId: string) => api.get(`/reviews/${userId}`),
};

// Subscriptions movido a feature/stripe-connect
// export const subscriptions = { ... }

export const legal = {
  todos: () => api.get('/legal'),
  estadoMio: () => api.get('/legal/estado/mio'),
  aceptar: (tipos?: string[], bookingId?: string) => api.post('/legal/aceptar', { tipos, bookingId }),
};

export const payments = {
  saldo: () => api.get('/payments/saldo'),
  movimientos: (limite?: number) => api.get('/payments/movimientos', { params: { limite } }),
  instrucciones: () => api.get('/payments/instrucciones'),
  recargar: (fd: FormData) => api.post('/payments/recargas', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  retirar: (d: { monto: string; banco: string; numeroCuenta: string; titular: string }) =>
    api.post('/payments/retiros', d),
};

export const metrics = {
  config: () => api.get('/metrics/config'),
  // Cifras reales para la portada. Antes estaban escritas a mano en Home.tsx.
  publicas: () => api.get('/metrics/public'),
};

export const users = {
  getPublic: (id: string) => api.get(`/users/${id}`),
  reviews: (id: string) => api.get(`/users/${id}/reviews`),
};


export const messages = {
  conversaciones: () => api.get('/messages'),
  hilo: (bookingId: string) => api.get(`/messages/${bookingId}`),
  enviar: (bookingId: string, texto: string) => api.post(`/messages/${bookingId}`, { texto }),
  sinLeer: () => api.get('/messages/sin-leer/total'),
};

export const adminApi = {
  bannedIdentities: (p?: any) => api.get('/admin/banned-identities', { params: p }),
  banIdentity: (d: { documentId: string; reason: string }) => api.post('/admin/banned-identities', d),
  unbanIdentity: (id: string) => api.delete(`/admin/banned-identities/${id}`),
  verifyCedula: (documentId: string) => api.post('/admin/verify-cedula', { documentId }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  pagosPendientes: () => api.get('/admin/pagos/pendientes'),
  confirmarPago: (id: string) => api.post(`/admin/pagos/${id}/confirmar`),
  rechazarPago: (id: string, motivo: string) => api.post(`/admin/pagos/${id}/rechazar`, { motivo }),
};


