import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { authRouter }          from './routes/auth';
import { vehiclesRouter }      from './routes/vehicles';
import { usersRouter }         from './routes/users';
import { bookingsRouter }      from './routes/bookings';
import { paymentsRouter }      from './routes/payments';
import { subscriptionsRouter } from './routes/subscriptions';
import { trackingRouter }      from './routes/tracking';
import { reviewsRouter }       from './routes/reviews';
import { adminRouter }         from './routes/admin';
import { pushRouter }          from './routes/push';
import { notificationsRouter } from './routes/notifications';
import { stripeRouter }        from './routes/stripe';
import { seedRouter }          from './routes/seed';
import { uploadRouter }        from './routes/upload';
import { setProvider }         from './services/verification';
import { WebServicesEcProvider } from './services/providers/webservices-ec';

const app  = express();
const PORT = process.env.PORT || 3000;

// 🔥 Stripe webhook MUST come before express.json() 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
// Stripe sends a raw Buffer; json() would break signature check
app.use(
  '/api/stripe',
  express.raw({ type: 'application/json' }),
  stripeRouter
);

// ⚙️ Global middleware ⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️⚙️
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", "https://rkwbixidpaqweavghfea.supabase.co", "wss://rkwbixidpaqweavghfea.supabase.co"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 🩺 Health check 🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺🩺
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date(), env: process.env.NODE_ENV })
);

// 🔌 API routes 🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌
app.use('/api/auth',          authRouter);
app.use('/api/users',         usersRouter);
app.use('/api/vehicles',      vehiclesRouter);
app.use('/api/bookings',      bookingsRouter);
app.use('/api/payments',      paymentsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/tracking',      trackingRouter);
app.use('/api/reviews',       reviewsRouter);
app.use('/api/admin',         adminRouter);
app.use('/api/push',          pushRouter);
app.use('/api/notifications', notificationsRouter);

// 🌱 Seed data 🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱
app.use('/api/seed', seedRouter);

// 📸 Upload de imágenes (Cloudinary) 📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸📸
app.use('/api/upload', uploadRouter);

// 🌐 Serve frontend static files (production: Railway unified deploy)
const publicDir = path.join(__dirname, '..', 'public');

// Assets con hash de Vite: cache inmutable por 1 año
app.use('/assets', express.static(path.join(publicDir, 'assets'), {
  maxAge: '365d',
  immutable: true,
}));

// Otros archivos estáticos (favicon, manifest, icons, etc.)
app.use(express.static(publicDir, {
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
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ⚠️ 404 — API routes that don't match
app.use('/api', (_req, res) => res.status(404).json({ data: null, error: 'Not found' }));

// 🧯 Error handler 🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯🧯
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ data: null, error: err.message ?? 'Internal server error' });
});

// 📡 Init verification provider 📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡📡
const wsProvider = new WebServicesEcProvider();
if (wsProvider.isConfigured) {
  setProvider(wsProvider);
  console.log('[Init] Verification provider: webservices.ec (API key configured)');
} else {
  console.log('[Init] Verification provider: NONE (set WEBSERVICES_EC_API_KEY env var)');
}

// 🚀 Start 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
app.listen(PORT, () =>
  console.log(`🚗 OmniDrive unified on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`)
);

export default app;
