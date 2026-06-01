import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';

export const usersRouter = Router();

// GET /api/users/:id — perfil público
usersRouter.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: {
      id: true, name: true, lastName: true,
      identityVerified: true, driverScore: true,
      totalTrips: true, totalKm: true,
      subscriptionTier: true, createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ data: null, error: 'User not found' });
  return res.json({ data: user, error: null });
}));

// GET /api/users/:id/vehicles
usersRouter.get('/:id/vehicles', asyncHandler(async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: req.params.id as string, available: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ data: vehicles, error: null });
}));

// GET /api/users/:id/reviews
usersRouter.get('/:id/reviews', asyncHandler(async (req: Request, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { targetId: req.params.id as string },
    include: {
      author: { select: { id: true, name: true, lastName: true } },
      booking: { select: { startAt: true, endAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ data: reviews, error: null });
}));
