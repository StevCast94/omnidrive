import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { vehiclesRouter } from './routes/vehicles';
import { usersRouter } from './routes/users';
import { bookingsRouter } from './routes/bookings';
import { paymentsRouter } from './routes/payments';
import { subscriptionsRouter } from './routes/subscriptions';
import { trackingRouter } from './routes/tracking';
import { reviewsRouter } from './routes/reviews';
import { adminRouter } from './routes/admin';
import { pushRouter } from './routes/push';
import { notificationsRouter } from './routes/notifications';
import { stripeRouter } from './routes/stripe';

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook MUST come before express.json() — raw body needed for signature
app.use('/api/stripe', express.raw({ type: 'application/json' }), stripeRouter);

// Global middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date(), env: process.env.NODE_ENV || 'development' })
);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/push', pushRouter);
app.use('/api/notifications', notificationsRouter);

// 404
app.use((_req, res) => res.status(404).json({ data: null, error: 'Not found' }));

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[OmniDrive Error]', err);
  res.status(500).json({ data: null, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`🚗 OmniDrive API on :${PORT}`));

export default app;
