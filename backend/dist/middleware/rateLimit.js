"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.authLimiter = void 0;
// ===== middleware/rateLimit.ts =====
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Limitador estricto para endpoints de autenticación (login admin, registro, etc.)
// Previene fuerza bruta de credenciales.
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 intentos por IP por ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: { data: null, error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});
// Limitador general para toda la API (mitiga abuso/scraping).
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minuto
    max: 120, // 120 requests por IP por minuto
    standardHeaders: true,
    legacyHeaders: false,
    message: { data: null, error: 'Demasiadas solicitudes. Reduce el ritmo.' },
});
//# sourceMappingURL=rateLimit.js.map