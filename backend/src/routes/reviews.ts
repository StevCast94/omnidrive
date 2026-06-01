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

  const review = await prisma.review.create({
    data: {
      bookingId,
      authorId: req.user!.id,
      targetId,
      vehicleId,
      rating,
      comment,
      categories,
    },
  });

  // Recalcular rating del target
  const avg = await prisma.review.aggregate({
    where: { targetId },
    _avg: { rating: true },
  });

  return res.json({ data: { review, newAverageRating: avg._avg.rating }, error: null });
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
