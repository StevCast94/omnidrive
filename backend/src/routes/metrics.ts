import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const metricsRouter = Router();

// GET /api/metrics — Estadísticas generales de la plataforma (sin auth, solo lectura)
metricsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();

    // Consultas en paralelo
    const [vehicles, usersByRole, bookings, payments] = await Promise.all([
      // Vehículos totales y activos
      prisma.vehicle.aggregate({
        _count: true,
        _sum: { totalRentals: true },
      }),
      // Usuarios agrupados por rol
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      // Reservas totales y activas
      prisma.booking.aggregate({
        _count: true,
      }),
      // Ingresos totales (transactions completadas)
      prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // También contar vehículos con available = true
    const vehiclesActive = await prisma.vehicle.count({
      where: { available: true },
    });

    // Contar reservas activas (status !== cancelled ni completed)
    const bookingsActive = await prisma.booking.count({
      where: {
        status: { notIn: ['cancelled', 'completed'] },
      },
    });

    // Construir users_by_role: inicializar todos en 0
    const usersByRoleMap: Record<string, number> = {
      user: 0,
      admin: 0,
      verifier: 0,
      superadmin: 0,
    };
    for (const group of usersByRole) {
      usersByRoleMap[group.role] = group._count;
    }

    const revenueTotal = payments._sum.amount
      ? Number(payments._sum.amount).toFixed(2)
      : '0.00';

    res.json({
      vehicles_total: vehicles._count,
      vehicles_active: vehiclesActive,
      users_total: usersByRole.reduce((sum, g) => sum + g._count, 0),
      users_by_role: usersByRoleMap,
      bookings_total: bookings._count,
      bookings_active: bookingsActive,
      revenue_total: `$${revenueTotal}`,
      updated_at: now,
    });
  } catch (error) {
    console.error('[Metrics] Error al obtener métricas:', error);
    res.status(500).json({
      data: null,
      error: 'Error al obtener métricas',
    });
  }
});
