import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ data: null, error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true },
    });
    if (!user) return res.status(401).json({ data: null, error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ data: null, error: 'Invalid token' });
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
