import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const notificationsRouter = Router();

// GET /api/notifications — últimas 50 notificaciones del usuario
notificationsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ data: notifications, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/notifications/:id/read
notificationsRouter.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id as string, userId: req.user!.id },
      data: { read: true },
    });
    return res.json({ data: { read: true }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/notifications/read-all
notificationsRouter.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    return res.json({ data: { ok: true }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});
