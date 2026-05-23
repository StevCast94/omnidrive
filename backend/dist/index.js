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
const payments_1 = require("./routes/payments");
const subscriptions_1 = require("./routes/subscriptions");
const tracking_1 = require("./routes/tracking");
const reviews_1 = require("./routes/reviews");
const admin_1 = require("./routes/admin");
const push_1 = require("./routes/push");
const notifications_1 = require("./routes/notifications");
const stripe_1 = require("./routes/stripe");
const seed_1 = require("./routes/seed");
const upload_1 = require("./routes/upload");
const verification_1 = require("./services/verification");
const webservices_ec_1 = require("./services/providers/webservices-ec");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// 🔥 Stripe webhook MUST come before express.json() 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
// Stripe sends a raw Buffer; json() would break signature check
app.use('/api/stripe', express_1.default.raw({ type: 'application/json' }), stripe_1.stripeRouter);
// ⚙️ Global middleware ⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            connectSrc: ["'self'", "https://rkwbixidpaqweavghfea.supabase.co", "wss://rkwbixidpaqweavghfea.supabase.co", "https://*.googleusercontent.com", "https://res.cloudinary.com"],
            fontSrc: ["'self'", "https:", "data:"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com"],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            upgradeInsecureRequests: [],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? '*',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// 🩺 Health check 🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date(), env: process.env.NODE_ENV }));
// 🔌 API routes 🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌
app.use('/api/auth', auth_1.authRouter);
app.use('/api/users', users_1.usersRouter);
app.use('/api/vehicles', vehicles_1.vehiclesRouter);
app.use('/api/bookings', bookings_1.bookingsRouter);
app.use('/api/payments', payments_1.paymentsRouter);
app.use('/api/subscriptions', subscriptions_1.subscriptionsRouter);
app.use('/api/tracking', tracking_1.trackingRouter);
app.use('/api/reviews', reviews_1.reviewsRouter);
app.use('/api/admin', admin_1.adminRouter);
app.use('/api/push', push_1.pushRouter);
app.use('/api/notifications', notifications_1.notificationsRouter);
// 🌱 Seed data 🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱
app.use('/api/seed', seed_1.seedRouter);
// 📸 Upload de imágenes (Cloudinary) 📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸
app.use('/api/upload', upload_1.uploadRouter);
// 🌐 Serve frontend static files (production: Railway unified deploy)
const publicDir = path_1.default.join(__dirname, '..', 'public');
// Assets con hash de Vite: cache inmutable por 1 año
app.use('/assets', express_1.default.static(path_1.default.join(publicDir, 'assets'), {
    maxAge: '365d',
    immutable: true,
}));
// Otros archivos estáticos (favicon, manifest, icons, etc.)
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
// 🔄 SPA fallback — non-API GET requests → index.html (React Router handles routing)
app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.sendFile(path_1.default.join(publicDir, 'index.html'));
});
// ⚠️ 404 — API routes that don't match
app.use('/api', (_req, res) => res.status(404).json({ data: null, error: 'Not found' }));
// 🧯 Error handler 🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯
app.use((err, _req, res, _next) => {
    console.error('[Error]', err);
    res.status(500).json({ data: null, error: err.message ?? 'Internal server error' });
});
// 📡 Init verification provider 📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡
const wsProvider = new webservices_ec_1.WebServicesEcProvider();
if (wsProvider.isConfigured) {
    (0, verification_1.setProvider)(wsProvider);
    console.log('[Init] Verification provider: webservices.ec (API key configured)');
}
else {
    console.log('[Init] Verification provider: NONE (set WEBSERVICES_EC_API_KEY env var)');
}
// 🚀 Start 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
app.listen(PORT, () => console.log(`🚗 OmniDrive unified on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`));
exports.default = app;
//# sourceMappingURL=index.js.map