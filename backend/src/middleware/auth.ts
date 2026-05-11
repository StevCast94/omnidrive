import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ data: null, error: 'No token provided' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !supabaseUser) return res.status(401).json({ data: null, error: 'Invalid token' });

    const localUser = await prisma.user.findUnique({
      where: { authId: supabaseUser.id },
      select: { id: true, role: true, email: true },
    });

    if (!localUser) return res.status(401).json({ data: null, error: 'User not registered in OmniDrive' });

    req.user = localUser;
    next();
  } catch {
    return res.status(401).json({ data: null, error: 'Auth verification failed' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ data: null, error: 'Admin access required' });
  next();
};

export const requireVerified = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { identityVerified: true },
  });
  if (!user?.identityVerified)
    return res.status(403).json({ data: null, error: 'Identity verification required' });
  next();
};
