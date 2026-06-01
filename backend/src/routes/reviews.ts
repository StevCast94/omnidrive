import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const reviewsRouter = Router();

// POST /api/reviews
reviewsRouter.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { bookingId, targetId, vehicleId, rating, comment, categories } = req.body;
  if (!bookingId || !targetId || !rating) {
    return res.status(400).json({ data: null, error: 'bookingId, targetId, and rating are required' });
  }

  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) {
    return res.status(409).json({ data: null, error: 'Ya calificaste esta reserva' });
  }

  // Crear la reseña
  const review = await prisma.review.create({
    data: { bookingId, authorId: req.user!.id, targetId, vehicleId, rating, comment, categories },
  });

  // Recalcular y persistir rating del usuario (target)
  const userAvg = await prisma.review.aggregate({
    where: { targetId },
    _avg: { rating: true },
  });
  await prisma.user.update({
    where: { id: targetId },
    data: { rating: Math.round((userAvg._avg.rating ?? 0) * 10) / 10 },
  });

  // Recalcular y persistir rating del vehículo
  if (vehicleId) {
    const vehicleAvg = await prisma.review.aggregate({
      where: { vehicleId },
      _avg: { rating: true },
    });
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { rating: Math.round((vehicleAvg._avg.rating ?? 0) * 10) / 10 },
    });
  }

  return res.json({
    data: {
      review,
      newUserRating: userAvg._avg.rating ? Math.round(userAvg._avg.rating * 10) / 10 : null,
    },
    error: null,
  });
}));

// GET /api/reviews/:userId
reviewsRouter.get('/:userId', asyncHandler(async (req, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { targetId: req.params.userId as string },
    include: {
      author: { select: { id: true, name: true, lastName: true, avatarUrl: true } },
      booking: { select: { startAt: true, endAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ data: reviews, error: null });
}));
