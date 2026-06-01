import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const subscriptionsRouter = Router();

// GET /api/subscriptions
subscriptionsRouter.get('/', asyncHandler(async (_req, res: Response) => {
  const plans = [
    { tier: 'free', name: 'Gratuito', price: 0, interval: null, features: ['Publicar hasta 1 vehículo', 'Acceso a reseñas'] },
    { tier: 'premium', name: 'Premium', price: 9.99, interval: 'monthly', features: ['Publicar hasta 5 vehículos', 'Estadísticas detalladas', 'Soporte prioritario'] },
    { tier: 'elite', name: 'Elite', price: 19.99, interval: 'monthly', features: ['Vehículos ilimitados', 'Verificación express', 'Sin comisiones', 'Soporte 24/7'] },
  ];
  return res.json({ data: plans, error: null });
}));

// POST /api/subscriptions
subscriptionsRouter.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { tier } = req.body;
  if (!['premium', 'elite'].includes(tier)) {
    return res.status(400).json({ data: null, error: 'Invalid tier' });
  }

  const existing = await prisma.subscription.findUnique({ where: { userId: req.user!.id } });
  if (existing?.status === 'active') {
    return res.status(409).json({ data: null, error: 'Already subscribed' });
  }

  const plan = tier === 'premium'
    ? { price: 9.99, features: ['publicar_5', 'estadisticas', 'soporte'] }
    : { price: 19.99, features: ['ilimitado', 'verificacion_express', 'sin_comisiones', 'soporte_24_7'] };

  const subscription = await prisma.subscription.create({
    data: {
      userId: req.user!.id,
      tier,
      price: plan.price,
      interval: 'monthly',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      benefits: plan.features,
    },
  });

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { subscriptionTier: tier },
  });

  return res.status(201).json({ data: subscription, error: null });
}));

// PUT /api/subscriptions/cancel
subscriptionsRouter.put('/cancel', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await prisma.subscription.findUnique({ where: { userId: req.user!.id } });
  if (!sub) return res.status(404).json({ data: null, error: 'No active subscription' });

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'cancelled' },
  });

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { subscriptionTier: 'free' },
  });

  return res.json({ data: { cancelled: true }, error: null });
}));
