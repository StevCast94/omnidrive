// ===== middleware/adminAuth.ts =====
// Autenticacion del panel admin con JWT propio (no Supabase).
// Extraido de routes/admin.ts para que otras rutas puedan protegerse igual.

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './auth';
import { env } from '../config/env';

export function adminAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ data: null, error: 'Token requerido' });

  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as any;
    next();
  } catch {
    return res.status(401).json({ data: null, error: 'Token invalido o expirado' });
  }
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ data: null, error: 'Solo superadmin' });
  }
  next();
}
