import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { verificarAccessToken } from '../services/auth';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string };
}

/**
 * Valida el access token propio.
 *
 * Antes cada peticion autenticada hacia una llamada de red a Supabase para
 * validar el token. Ademas de lento, ataba cada request a que un tercero
 * estuviera vivo: cuando ese proyecto desaparecio, toda la app autenticada
 * dejo de funcionar. Ahora la validacion es local.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // EventSource no puede enviar cabeceras, asi que el flujo SSE del rastreo
  // manda el token por query. Se acepta SOLO ahi: en el resto de rutas un
  // token en la URL acabaria en logs de acceso y en el historial del
  // navegador, que es justo lo que no queremos.
  const esFlujoSSE = req.path.endsWith('/vivo');
  const token = req.headers.authorization?.split(' ')[1]
    ?? (esFlujoSSE ? (req.query.token as string | undefined) : undefined);

  if (!token) return res.status(401).json({ data: null, error: 'No token provided' });

  let payload;
  try {
    payload = verificarAccessToken(token);
  } catch {
    return res.status(401).json({ data: null, error: 'Token invalido o expirado' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true, tokenVersion: true },
  });
  if (!user) return res.status(401).json({ data: null, error: 'User profile not found' });

  // Un cambio de contrasena o un baneo incrementan tokenVersion: los access
  // tokens emitidos antes dejan de valer sin esperar a que caduquen.
  if (user.tokenVersion !== payload.tv) {
    return res.status(401).json({ data: null, error: 'Sesion cerrada. Inicia sesion de nuevo.' });
  }

  req.user = { id: user.id, role: user.role, email: user.email };
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
