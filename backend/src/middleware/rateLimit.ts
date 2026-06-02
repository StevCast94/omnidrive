// ===== middleware/rateLimit.ts =====
import rateLimit from 'express-rate-limit';

// Limitador estricto para endpoints de autenticación (login admin, registro, etc.)
// Previene fuerza bruta de credenciales.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                  // 10 intentos por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

// Limitador general para toda la API (mitiga abuso/scraping).
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120,            // 120 requests por IP por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: 'Demasiadas solicitudes. Reduce el ritmo.' },
});
