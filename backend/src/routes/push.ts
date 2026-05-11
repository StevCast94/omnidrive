import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { storePushSub, removePushSub } from '../services/push';

export const pushRouter = Router();

// POST /api/push/subscribe
pushRouter.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ data: null, error: 'Invalid subscription object' });

  await storePushSub(req.user!.id, { endpoint, keys });
  return res.json({ data: { subscribed: true }, error: null });
});

// DELETE /api/push/subscribe
pushRouter.delete('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body;
  if (endpoint) await removePushSub(req.user!.id, endpoint);
  return res.json({ data: { unsubscribed: true }, error: null });
});
