import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { adminAuth } from '../middleware/adminAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { env } from '../config/env';

export const metricsRouter = Router();

// GET /api/metrics/public — lo unico que puede ver cualquiera.
// Alimenta el selector de pais y las cifras de la portada, que hoy estan
// escritas a mano en Home.tsx. Nada de usuarios, reservas ni ingresos.
metricsRouter.get('/public', asyncHandler(async (_req: Request, res: Response) => {
  const [vehiclesActive, usersVerified, usersTotal, ratingAvg] = await Promise.all([
    prisma.vehicle.count({ where: { available: true } }),
    prisma.user.count({ where: { identityVerified: true, role: 'user' } }),
    prisma.user.count({ where: { role: 'user' } }),
    prisma.vehicle.aggregate({ _avg: { rating: true }, where: { rating: { gt: 0 } } }),
  ]);

  res.json({
    data: {
      country: env.COUNTRY_CODE,
      vehicles_active: vehiclesActive,
      // Porcentaje real, no el 100% fijo de la portada.
      verified_pct: usersTotal > 0 ? Math.round((usersVerified / usersTotal) * 100) : 0,
      // null cuando todavia no hay resenas: la portada debe ocultar la cifra,
      // no inventar un 4.9.
      rating_avg: ratingAvg._avg.rating ? Number(ratingAvg._avg.rating.toFixed(1)) : null,
      updated_at: new Date().toISOString(),
    },
    error: null,
  });
}));

// GET /api/metrics — metricas de negocio. Solo admin: expone usuarios,
// reservas e ingresos, que hasta ahora estaban abiertos a cualquiera.
metricsRouter.get('/', adminAuth, asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date().toISOString();

  const [vehicles, usersByRole, bookings, payments, vehiclesActive, bookingsActive] =
    await Promise.all([
      prisma.vehicle.aggregate({ _count: true, _sum: { totalRentals: true } }),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.booking.aggregate({ _count: true }),
      prisma.transaction.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.vehicle.count({ where: { available: true } }),
      prisma.booking.count({ where: { status: { notIn: ['cancelled', 'completed'] } } }),
    ]);

  const usersByRoleMap: Record<string, number> = { user: 0, admin: 0, verifier: 0, superadmin: 0 };
  for (const group of usersByRole) usersByRoleMap[group.role] = group._count;

  // amount esta en centavos enteros desde la migracion multipais.
  const revenueCents = payments._sum.amount ?? 0;

  res.json({
    country: env.COUNTRY_CODE,
    vehicles_total: vehicles._count,
    vehicles_active: vehiclesActive,
    users_total: usersByRole.reduce((sum, g) => sum + g._count, 0),
    users_by_role: usersByRoleMap,
    bookings_total: bookings._count,
    bookings_active: bookingsActive,
    revenue_total_cents: revenueCents,
    updated_at: now,
  });
}));
