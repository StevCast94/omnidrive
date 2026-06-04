"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
exports.metricsRouter = (0, express_1.Router)();
// GET /api/metrics — Estadísticas generales de la plataforma (sin auth, solo lectura)
exports.metricsRouter.get('/', async (_req, res) => {
    try {
        const now = new Date().toISOString();
        // Consultas en paralelo
        const [vehicles, usersByRole, bookings, payments] = await Promise.all([
            // Vehículos totales y activos
            prisma_1.prisma.vehicle.aggregate({
                _count: true,
                _sum: { totalRentals: true },
            }),
            // Usuarios agrupados por rol
            prisma_1.prisma.user.groupBy({
                by: ['role'],
                _count: true,
            }),
            // Reservas totales y activas
            prisma_1.prisma.booking.aggregate({
                _count: true,
            }),
            // Ingresos totales (transactions completadas)
            prisma_1.prisma.transaction.aggregate({
                _sum: { amount: true },
                _count: true,
            }),
        ]);
        // También contar vehículos con available = true
        const vehiclesActive = await prisma_1.prisma.vehicle.count({
            where: { available: true },
        });
        // Contar reservas activas (status !== cancelled ni completed)
        const bookingsActive = await prisma_1.prisma.booking.count({
            where: {
                status: { notIn: ['cancelled', 'completed'] },
            },
        });
        // Construir users_by_role: inicializar todos en 0
        const usersByRoleMap = {
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
    }
    catch (error) {
        console.error('[Metrics] Error al obtener métricas:', error);
        res.status(500).json({
            data: null,
            error: 'Error al obtener métricas',
        });
    }
});
//# sourceMappingURL=metrics.js.map