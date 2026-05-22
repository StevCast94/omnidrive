import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { supabase } from '../lib/supabase';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ data: null, error: 'No token provided' });

  // Validate token with Supabase Auth
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser)
    return res.status(401).json({ data: null, error: 'Invalid or expired token' });

  // Look up our app user by Supabase auth UUID
  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: { id: true, role: true, email: true },
  });
  if (!user) return res.status(401).json({ data: null, error: 'User profile not found' });

  req.user = user;
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin' && req.user?.role !== 'verifier')
    return res.status(403).json({ data: null, error: 'Admin access required' });
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'superadmin')
    return res.status(403).json({ data: null, error: 'Superadmin access required' });
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
