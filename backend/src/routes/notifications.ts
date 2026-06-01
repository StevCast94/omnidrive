import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const notifs = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, read: false },
  });
  return res.json({ data: notifs, unreadCount, error: null });
}));

// PUT /api/notifications/:id/read
notificationsRouter.put('/:id/read', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const notif = await prisma.notification.updateMany({
    where: { id: req.params.id as string, userId: req.user!.id },
    data: { read: true },
  });
  return res.json({ data: { updated: notif.count }, error: null });
}));
