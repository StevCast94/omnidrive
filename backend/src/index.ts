import express from 'express';
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
import { setProvider }         from './services/verification';
import { WebServicesEcProvider } from './services/providers/webservices-ec';

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Stripe webhook MUST come before express.json() ──────────
// Stripe sends a raw Buffer; json() would break signature check
app.use(
  '/api/stripe',
  express.raw({ type: 'application/json' }),
  stripeRouter
);

// ── Global middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date(), env: process.env.NODE_ENV })
);

// ── API routes ───────────────────────────────────────────────
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

// ── Seed data ─────────────────────────────────────────────────
app.use('/api/seed', seedRouter);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ data: null, error: 'Not found' }));

// ── Error handler ────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ data: null, error: err.message ?? 'Internal server error' });
});

// ── Init verification provider ──────────────────────────────
const wsProvider = new WebServicesEcProvider();
if (wsProvider.isConfigured) {
  setProvider(wsProvider);
  console.log('[Init] Verification provider: webservices.ec (API key configured)');
} else {
  console.log('[Init] Verification provider: NONE (set WEBSERVICES_EC_API_KEY env var)');
}

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`🚗 OmniDrive API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`)
);

export default app;
