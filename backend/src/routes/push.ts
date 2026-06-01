import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { storePushSub, removePushSub } from '../services/push';
import { asyncHandler } from '../middleware/asyncHandler';

export const pushRouter = Router();

// POST /api/push/subscribe
pushRouter.post('/subscribe', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ data: null, error: 'Invalid subscription object' });
  }
  storePushSub(req.user!.id, { endpoint, keys });
  return res.json({ data: { subscribed: true }, error: null });
}));

// DELETE /api/push/subscribe
pushRouter.delete('/subscribe', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  removePushSub(req.user!.id);
  return res.json({ data: { unsubscribed: true }, error: null });
}));
