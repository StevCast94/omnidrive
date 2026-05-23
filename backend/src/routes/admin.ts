import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabase } from '../lib/supabase';
import jwt from 'jsonwebtoken';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { refundPayment } from '../services/wallet';
import { verifyIdentity, IdentityResult } from '../services/verification';

const JWT_SECRET = process.env.JWT_SECRET || 'omnidrive_admin_jwt_2026';

export const adminRouter = Router();

// ── Admin Login (no requiere token, usa username + password) ──
adminRouter.post('/auth/login', async (req: any, res: any) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  try {
    // Buscar admin por username
    const admin = await prisma.user.findUnique({ where: { username } });
    if (!admin || !['admin', 'superadmin', 'verifier'].includes(admin.role)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña contra Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: admin.email,
      password,
    });
    if (error || !data.session) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Crear token JWT propio para admin
    const token = jwt.sign(
      { id: admin.id, role: admin.role, username: admin.username },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    return res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        lastName: admin.lastName,
        role: admin.role,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ── Verificar token admin ──
adminRouter.get('/auth/verify', async (req: any, res: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, name: true, lastName: true, role: true },
    });
    if (!user) return res.status(401).json({ error: 'Admin no encontrado' });
    res.json({ ok: true, admin: user });
  } catch { res.status(401).json({ error: 'Token inválido' }); }
});

// ── Middleware: proteger TODAS las rutas admin con JWT propio (reemplaza authenticate + requireAdmin) ──
adminRouter.use((req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const allowedRoles = ['admin', 'superadmin', 'verifier'];
    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = { id: decoded.id, role: decoded.role, email: decoded.username || '' };
    next();
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
});

// GET /api/admin/users
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  const { verified, page = '1', limit = '20', search } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (verified !== undefined) where.identityVerified = verified === 'true';
  if (search) where.OR = [
    { email: { contains: search, mode: 'insensitive' } },
    { name: { contains: search, mode: 'insensitive' } },
    { documentId: { contains: search } },
  ];

  try {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, phone: true, name: true, lastName: true,
          documentType: true, documentId: true, identityVerified: true,
          selfieUrl: true, documentFrontUrl: true, documentBackUrl: true,
          verificationNotes: true,
          walletBalance: true, subscriptionTier: true, driverScore: true,
          totalTrips: true, role: true, createdAt: true, birthDate: true, gender: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    return res.json({ data: { users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/admin/users/:id/verify — Verificar identidad de usuario
adminRouter.put('/users/:id/verify', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id as string;

    // Auto-validacion basica: verificar cedula con WebServices.ec
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, documentId: true, documentType: true, documentFrontUrl: true, documentBackUrl: true, selfieUrl: true },
    });
    if (!user) return res.status(404).json({ data: null, error: 'Usuario no encontrado' });

    let autoValidation: IdentityResult | null = null;
    if (user.documentType === 'cedula' && user.documentId && user.documentId.length === 10) {
      try {
        autoValidation = await verifyIdentity(user.documentId);
      } catch (e: any) {
        autoValidation = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        identityVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user!.id,
        verificationNotes: autoValidation
          ? (autoValidation.success
              ? 'Auto-validacion OK. Datos coinciden con Registro Civil.'
              : `Auto-validacion fallo. ${autoValidation.error || 'Cedula no valida'}. Verificar manualmente.`)
          : 'Verificado manualmente por admin.',
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'identity_verified',
        title: '✅ Identidad verificada',
        body: 'Tu identidad fue verificada. ¡Ya puedes publicar vehículos!',
      },
    });

    return res.json({ data: { ...updated, autoValidation }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/admin/users/:id/reject — Rechazar verificacion con motivo
adminRouter.put('/users/:id/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ data: null, error: 'reason (motivo de rechazo) es requerido' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id as string },
      data: {
        identityVerified: false,
        verificationNotes: reason,
        verifiedBy: req.user!.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: req.params.id as string,
        type: 'identity_rejected',
        title: '❌ Verificación rechazada',
        body: `Motivo: ${reason}. Corrige tus documentos y reenvía desde tu perfil.`,
      },
    });

    return res.json({ data: updated, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/vehicles
adminRouter.get('/vehicles', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  try {
    const [vehicles, total] = await prisma.$transaction([
      prisma.vehicle.findMany({
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, name: true, email: true } } },
      }),
      prisma.vehicle.count(),
    ]);
    return res.json({ data: { vehicles, total }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/bookings
adminRouter.get('/bookings', async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (status) where.status = status;
  try {
    const [bookings, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { brand: true, model: true, plate: true } },
          tenant: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);
    return res.json({ data: { bookings, total }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/transactions
adminRouter.get('/transactions', async (req: AuthRequest, res: Response) => {
  const { type, page = '1', limit = '30' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (type) where.type = type;
  try {
    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.transaction.count({ where }),
    ]);
    return res.json({ data: { transactions, total }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/disputes
adminRouter.get('/disputes', async (_req, res: Response) => {
  try {
    const disputes = await prisma.booking.findMany({
      where: { status: 'disputed' },
      orderBy: { updatedAt: 'desc' },
      include: {
        vehicle: { select: { brand: true, model: true, plate: true, ownerId: true } },
        tenant: { select: { id: true, name: true, email: true } },
      },
    });
    return res.json({ data: disputes, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/admin/disputes/:id/resolve
adminRouter.put('/disputes/:id/resolve', async (req: AuthRequest, res: Response) => {
  const { resolution, refundAmount, faultParty } = req.body;
  if (!resolution) return res.status(400).json({ data: null, error: 'resolution required' });

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: { vehicle: true },
    });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
    if (booking.status !== 'disputed')
      return res.status(400).json({ data: null, error: 'Booking is not in disputed status' });

    // Refund tenant if fault is owner's, or partial refund
    if (refundAmount && refundAmount > 0) {
      await refundPayment(booking.id, booking.tenantId, parseFloat(refundAmount));
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id as string },
      data: {
        status: 'completed',
        damageReport: {
          ...(booking.damageReport as object ?? {}),
          resolution,
          faultParty,
          refundAmount,
          resolvedAt: new Date().toISOString(),
          resolvedBy: req.user!.id,
        },
      },
    });

    // Notify both parties
    await prisma.notification.createMany({
      data: [
        {
          userId: booking.tenantId,
          type: 'dispute_resolved',
          title: '⚖️ Disputa resuelta',
          body: `Resolución: ${resolution}`,
          data: { bookingId: booking.id },
        },
        {
          userId: booking.vehicle.ownerId,
          type: 'dispute_resolved',
          title: '⚖️ Disputa resuelta',
          body: `Resolución: ${resolution}`,
          data: { bookingId: booking.id },
        },
      ],
    });

    return res.json({ data: updated, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// BANNED IDENTITIES
// ═══════════════════════════════════════════════════════════════════════

// GET /api/admin/banned-identities
adminRouter.get('/banned-identities', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', active } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (active !== undefined) where.active = active === 'true';

  try {
    const [items, total] = await prisma.$transaction([
      prisma.bannedIdentity.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bannedIdentity.count({ where }),
    ]);
    return res.json({
      data: { items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      error: null,
    });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/admin/banned-identities
adminRouter.post('/banned-identities', async (req: AuthRequest, res: Response) => {
  const { documentId, reason } = req.body;
  if (!documentId || !reason) {
    return res.status(400).json({ data: null, error: 'documentId y reason son requeridos' });
  }

  try {
    // Si ya existe, reactivar
    const existing = await prisma.bannedIdentity.findUnique({ where: { documentId } });
    if (existing) {
      const updated = await prisma.bannedIdentity.update({
        where: { documentId },
        data: { active: true, reason, bannedBy: req.user!.id },
      });
      return res.json({ data: updated, error: null });
    }

    const banned = await prisma.bannedIdentity.create({
      data: { documentId, reason, bannedBy: req.user!.id },
    });

    // Desverificar al usuario si tenía esa cédula
    await prisma.user.updateMany({
      where: { documentId, identityVerified: true },
      data: { identityVerified: false, verifiedAt: null },
    });

    return res.status(201).json({ data: banned, error: null });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ data: null, error: 'Esta cédula ya está vetada' });
    }
    return res.status(500).json({ data: null, error: e.message });
  }
});

// DELETE /api/admin/banned-identities/:id — desactivar veto
adminRouter.delete('/banned-identities/:id', async (req: AuthRequest, res: Response) => {
  try {
    const banned = await prisma.bannedIdentity.update({
      where: { id: req.params.id as string },
      data: { active: false },
    });
    return res.json({ data: banned, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/verify-cedula — endpoint admin para verificar una cédula manualmente
adminRouter.post('/verify-cedula', async (req: AuthRequest, res: Response) => {
  const { documentId } = req.body;
  if (!documentId) {
    return res.status(400).json({ data: null, error: 'documentId es requerido' });
  }

  try {
    const result = await verifyIdentity(documentId);
    return res.json({ data: result, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// DELETE /api/admin/users/:id — Eliminar usuario completo (DB + Supabase Auth)
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;

  try {
    // 1. Obtener usuario para saber su authId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, authId: true, email: true, name: true },
    });
    if (!user) return res.status(404).json({ data: null, error: 'Usuario no encontrado' });

    // 2. Verificar que no tenga bookings activos
    const activeBooking = await prisma.booking.findFirst({
      where: { OR: [{ tenantId: userId }, { vehicle: { ownerId: userId } }], status: { in: ['active', 'confirmed'] } },
    });
    if (activeBooking) {
      return res.status(409).json({ data: null, error: 'El usuario tiene reservas activas. Cancélalas antes de eliminar.' });
    }

    // 3. Eliminar registros relacionados en orden (evitar FK constraints)
    // Nota: los where se pasan explícitamente para evitar ambigüedad de tipos en $transaction
    // Primero obtener IDs de bookings a eliminar para limpiar reviews antes
    const vehicleIds = (await prisma.vehicle.findMany({ where: { ownerId: userId }, select: { id: true } })).map(v => v.id);
    const bookingIds = (await prisma.booking.findMany({
      where: { OR: [{ vehicleId: { in: vehicleIds } }, { tenantId: userId }] },
      select: { id: true },
    })).map(b => b.id);

    await prisma.$transaction([
      // Reviews vinculadas a esos bookings
      ...(bookingIds.length > 0
        ? [prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } })]
        : []
      ),
      // Reviews del usuario como autor (si no se cubrieron arriba)
      prisma.review.deleteMany({ where: { authorId: userId } }),
      // Notificaciones
      prisma.notification.deleteMany({ where: { userId: userId } }),
      prisma.userDocument.deleteMany({ where: { userId: userId } }),
      prisma.subscription.deleteMany({ where: { userId: userId } }),
      // Bookings de vehículos del usuario
      ...(vehicleIds.length > 0
        ? [prisma.booking.deleteMany({ where: { vehicleId: { in: vehicleIds } } })]
        : []
      ),
      // Vehículos del usuario
      prisma.vehicle.deleteMany({ where: { ownerId: userId } }),
      // Bookings donde es tenant
      prisma.booking.deleteMany({ where: { tenantId: userId } }),
      // Transacciones
      prisma.transaction.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
      // Finalmente el usuario
      prisma.user.delete({ where: { id: userId } }),
    ]);

    // 4. Eliminar de Supabase Auth
    const { error: supabaseErr } = await supabase.auth.admin.deleteUser(user.authId);
    if (supabaseErr) {
      console.warn('[admin delete-user] Supabase deletion warning:', supabaseErr.message);
      // No fallamos — el usuario ya fue eliminado de nuestra DB
    }

    return res.json({ data: { deleted: true, email: user.email }, error: null });
  } catch (e: any) {
    console.error('[admin delete-user] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/metrics
adminRouter.get('/metrics', async (_req, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      verifiedUsers,
      totalVehicles,
      activeBookings,
      revenueToday,
      revenueMonth,
      disputeCount,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { identityVerified: true } }),
      prisma.vehicle.count(),
      prisma.booking.count({ where: { status: 'active' } }),
      prisma.transaction.aggregate({
        where: { type: 'commission', status: 'completed', createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'commission', status: 'completed', createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.booking.count({ where: { status: 'disputed' } }),
    ]);

    // Occupancy: active / total available
    const availableVehicles = await prisma.vehicle.count({ where: { available: true } });
    const occupancyRate = availableVehicles > 0 ? (activeBookings / availableVehicles) * 100 : 0;

    return res.json({
      data: {
        totalUsers,
        verifiedUsers,
        totalVehicles,
        activeBookings,
        openDisputes: disputeCount,
        revenueToday: revenueToday._sum.amount ?? 0,
        revenueMonth: revenueMonth._sum.amount ?? 0,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
      },
      error: null,
    });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// ── Superadmin: Admin management ──

adminRouter.get('/admins', async (req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'superadmin', 'verifier'] } },
      select: { id: true, email: true, name: true, lastName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ data: admins, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

adminRouter.post('/create-admin', async (req: AuthRequest, res: Response) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ data: null, error: 'email, password y role requeridos' });
  }
  if (!['admin', 'verifier'].includes(role)) {
    return res.status(400).json({ data: null, error: 'Role debe ser admin o verifier' });
  }
  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authErr) return res.status(400).json({ data: null, error: authErr.message });
    const name = email.split('@')[0];
    const user = await prisma.user.create({
      data: {
        authId: authData.user.id, email, phone: '0000000000',
        name: name.split('.')[0] || 'Admin',
        lastName: name.split('.').slice(1).join('.') || email.split('@')[0],
        documentType: 'cedula', documentId: 'admin-' + authData.user.id.slice(0, 8),
        role,
      },
      select: { id: true, email: true, name: true, lastName: true, role: true },
    });
    return res.status(201).json({ data: user, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

adminRouter.delete('/delete-admin/:userId', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ data: null, error: 'No encontrado' });
    if (target.role === 'superadmin') {
      return res.status(403).json({ data: null, error: 'No puedes eliminar al superadmin' });
    }
    await supabase.auth.admin.deleteUser(target.authId);
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ data: { deleted: userId }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});
