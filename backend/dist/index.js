"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = require("./routes/auth");
const vehicles_1 = require("./routes/vehicles");
const users_1 = require("./routes/users");
const bookings_1 = require("./routes/bookings");
const tracking_1 = require("./routes/tracking");
const reviews_1 = require("./routes/reviews");
const admin_1 = require("./routes/admin");
const push_1 = require("./routes/push");
const notifications_1 = require("./routes/notifications");
const seed_1 = require("./routes/seed");
const upload_1 = require("./routes/upload");
const metrics_1 = require("./routes/metrics");
const verification_1 = require("./services/verification");
const webservices_ec_1 = require("./services/providers/webservices-ec");
const env_1 = require("./config/env");
const rateLimit_1 = require("./middleware/rateLimit");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Railway corre detrás de un proxy: necesario para que rate-limit lea la IP real
app.set('trust proxy', 1);
// Security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            connectSrc: ["'self'", "https://rkwbixidpaqweavghfea.supabase.co", "wss://rkwbixidpaqweavghfea.supabase.co", "https://*.googleusercontent.com", "https://res.cloudinary.com"],
            fontSrc: ["'self'", "https:", "data:"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com", "https://rkwbixidpaqweavghfea.supabase.co", "https://images.unsplash.com"],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            upgradeInsecureRequests: [],
        },
    },
}));
app.use((0, cors_1.default)({ origin: env_1.env.FRONTEND_URL || true, credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Rate limiting general para toda la API
app.use('/api', rateLimit_1.apiLimiter);
// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date(), env: process.env.NODE_ENV }));
// API routes
app.use('/api/auth', auth_1.authRouter);
app.use('/api/users', users_1.usersRouter);
app.use('/api/vehicles', vehicles_1.vehiclesRouter);
app.use('/api/bookings', bookings_1.bookingsRouter);
app.use('/api/tracking', tracking_1.trackingRouter);
app.use('/api/reviews', reviews_1.reviewsRouter);
app.use('/api/admin', admin_1.adminRouter);
app.use('/api/push', push_1.pushRouter);
app.use('/api/notifications', notifications_1.notificationsRouter);
app.use('/api/upload', upload_1.uploadRouter);
app.use('/api/metrics', metrics_1.metricsRouter);
// Seed: solo disponible en dev y con SEED_ENABLED=true (nunca en producción)
if (env_1.env.SEED_ENABLED && env_1.env.NODE_ENV !== 'production') {
    app.use('/api/seed', seed_1.seedRouter);
    console.warn('[Init] ⚠️  Endpoint /api/seed HABILITADO (SEED_ENABLED=true). No usar en produccion.');
}
// Serve frontend static files
const publicDir = path_1.default.join(__dirname, '..', 'public');
// Vite assets with content hash: immutable cache for 1 year
app.use('/assets', express_1.default.static(path_1.default.join(publicDir, 'assets'), {
    maxAge: '365d',
    immutable: true,
}));
// Other static files (favicon, manifest, etc.)
app.use(express_1.default.static(publicDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }
    },
}));
// SPA fallback: non-API GET requests -> index.html (React Router handles routing)
app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.sendFile(path_1.default.join(publicDir, 'index.html'));
});
// 404 for unmatched API routes
app.use('/api', (_req, res) => res.status(404).json({ data: null, error: 'Not found' }));
// Global error handler (catches errors from asyncHandler and other middlewares)
app.use((err, _req, res, _next) => {
    // Prisma unique constraint violation
    if (err?.code === 'P2002') {
        const field = err.meta?.target?.join?.(', ') || 'campo unico';
        return res.status(409).json({ data: null, error: `Ya existe otro registro con ese ${field}` });
    }
    // Prisma not found
    if (err?.code === 'P2025') {
        return res.status(404).json({ data: null, error: 'Registro no encontrado' });
    }
    // Multer file size error
    if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ data: null, error: 'El archivo excede el tamano maximo permitido (10MB)' });
    }
    // JWT errors
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
        return res.status(401).json({ data: null, error: 'Token invalido o expirado' });
    }
    console.error('[Error]', err);
    res.status(500).json({ data: null, error: err?.message ?? 'Error interno del servidor' });
});
// Init verification provider
const wsProvider = new webservices_ec_1.WebServicesEcProvider();
if (wsProvider.isConfigured) {
    (0, verification_1.setProvider)(wsProvider);
    console.log('[Init] Verification provider: webservices.ec (API key configured)');
}
else {
    console.log('[Init] Verification provider: NONE (set WEBSERVICES_EC_API_KEY env var)');
}
// Start
app.listen(PORT, () => console.log(`OmniDrive unified on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`));
exports.default = app;
//# sourceMappingURL=index.js.map