import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabase } from '../lib/supabase';
import jwt from 'jsonwebtoken';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { refundPayment } from '../services/wallet';
import { verifyIdentity } from '../services/verification';
import { asyncHandler } from '../middleware/asyncHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'omnidrive_admin_jwt_2026';

export const adminRouter = Router();

// ── Admin Login (JWT propio, no Supabase) ──
adminRouter.post('/auth/login', asyncHandler(async (req, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contrasena requeridos' });

  const admin = await prisma.user.findUnique({ where: { username } });
  if (!admin || admin.role === 'user') return res.status(401).json({ error: 'Credenciales invalidas' });

  // Validate password against Supabase Auth
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: admin.email, password });
  if (signInErr) return res.status(401).json({ error: 'Credenciales invalidas' });

  const token = jwt.sign({ role: admin.role, id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({
    data: {
      token,
      user: { id: admin.id, email: admin.email, name: admin.name, lastName: admin.lastName, role: admin.role, username: admin.username },
    },
    error: null,
  });
}));

// ── Auth middleware for admin (JWT propio) ──
function adminAuth(req: AuthRequest, res: Response, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function requireSuperAdmin(req: AuthRequest, res: Response, next: any) {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin' });
  next();
}

// ── Dashboard stats ──
adminRouter.get('/dashboard', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [
    totalUsers, totalVehicles, totalBookings, pendingVerifications,
    activeBookings, revenue, recentUsers, recentBookings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vehicle.count(),
    prisma.booking.count(),
    prisma.user.count({ where: { identityVerified: false, selfieUrl: { not: null } } }),
    prisma.booking.count({ where: { status: 'active' } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'payment', status: 'completed' } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, lastName: true, email: true, role: true, identityVerified: true, createdAt: true } }),
    prisma.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { vehicle: { select: { brand: true, model: true } }, tenant: { select: { name: true, lastName: true } } } }),
  ]);

  return res.json({ data: { totalUsers, totalVehicles, totalBookings, pendingVerifications, activeBookings, revenue: revenue._sum.amount ?? 0, recentUsers, recentBookings }, error: null });
}));

// ── Users CRUD ──
adminRouter.get('/users', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, role, verified, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: any = {};
  if (role) where.role = role;
  if (verified === 'true') where.identityVerified = true;
  if (verified === 'false') where.identityVerified = false;
  if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { documentId: { contains: search } }];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, lastName: true, phone: true, documentType: true, documentId: true, role: true, identityVerified: true, verificationNotes: true, avatarUrl: true, walletBalance: true, subscriptionTier: true, driverScore: true, totalTrips: true, createdAt: true, birthDate: true, gender: true },
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({ data: { users, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
}));

adminRouter.get('/users/:id', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: { id: true, email: true, name: true, lastName: true, phone: true, documentType: true, documentId: true, gender: true, birthDate: true, role: true, identityVerified: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true, verificationNotes: true, avatarUrl: true, walletBalance: true, subscriptionTier: true, driverScore: true, totalTrips: true, createdAt: true, updatedAt: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ data: user, error: null });
}));

adminRouter.put('/users/:id/role', adminAuth, requireSuperAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { role, username, name, lastName, password } = req.body;
  const data: any = {};
  if (role) data.role = role;
  if (username) data.username = username;
  if (name) data.name = name;
  if (lastName) data.lastName = lastName;

  const updated = await prisma.user.update({ where: { id: req.params.id as string }, data, select: { id: true, email: true, name: true, lastName: true, role: true, username: true } });

  if (password) {
    const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (user) {
      await supabase.auth.admin.updateUserById(user.authId, { password }).catch(e => console.warn('[admin] Password update warning:', e.message));
    }
  }

  return res.json({ data: updated, error: null });
}));

adminRouter.put('/users/:id/verify', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { verified, notes } = req.body;
  const updated = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { identityVerified: verified, selfieUrl: verified ? undefined : null, documentFrontUrl: verified ? undefined : null, documentBackUrl: verified ? undefined : null, verificationNotes: notes || null, verifiedBy: req.user!.id, verifiedAt: verified ? new Date() : undefined },
    select: { id: true, name: true, lastName: true, identityVerified: true, verificationNotes: true, verifiedAt: true },
  });
  return res.json({ data: updated, error: null });
}));

adminRouter.delete('/users/:id', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Delete related data in order
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.message.deleteMany({ where: { senderId: id } }),
    prisma.conversation.deleteMany({ where: { userIds: { has: id } } }),
    prisma.review.deleteMany({ where: { OR: [{ authorId: id }, { targetId: id }] } }),
    prisma.transaction.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
    prisma.subscription.deleteMany({ where: { userId: id } }),
    prisma.userDocument.deleteMany({ where: { userId: id } }),
    prisma.booking.deleteMany({ where: { OR: [{ tenantId: id }, { renterId: id }] } }),
    prisma.vehicle.deleteMany({ where: { ownerId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  // Try to delete from Supabase Auth (non-critical)
  supabase.auth.admin.deleteUser(user.authId).catch(e => console.warn('[admin] Supabase deletion warning:', e.message));

  return res.json({ data: { deleted: true }, error: null });
}));

// ── Vehicles CRUD ──
adminRouter.get('/vehicles', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: any = {};
  if (search) where.OR = [{ brand: { contains: search, mode: 'insensitive' } }, { model: { contains: search, mode: 'insensitive' } }, { plate: { contains: search, mode: 'insensitive' } }];

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { owner: { select: { id: true, name: true, lastName: true, email: true } }, _count: { select: { bookings: true } } },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return res.json({ data: { vehicles, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
}));

// ── Bookings CRUD ──
adminRouter.get('/bookings', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: { vehicle: { select: { id: true, brand: true, model: true, plate: true } }, tenant: { select: { id: true, name: true, lastName: true } } },
    }),
    prisma.booking.count({ where }),
  ]);

  return res.json({ data: { bookings, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
}));

// ── Banned Identities ──
adminRouter.get('/banned-identities', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const bans = await prisma.bannedIdentity.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json({ data: bans, error: null });
}));

adminRouter.post('/banned-identities', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentId, reason } = req.body;
  if (!documentId || !reason) return res.status(400).json({ error: 'documentId and reason required' });

  const existing = await prisma.bannedIdentity.findUnique({ where: { documentId } });
  if (existing) return res.status(409).json({ error: 'Already banned' });

  const ban = await prisma.bannedIdentity.create({ data: { documentId, reason, bannedBy: req.user!.id } });
  return res.json({ data: ban, error: null });
}));

adminRouter.delete('/banned-identities/:id', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.bannedIdentity.update({ where: { id: req.params.id as string }, data: { active: false } });
  return res.json({ data: { unbanned: true }, error: null });
}));

// ── Verification ──
adminRouter.post('/verify-cedula', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: 'documentId required' });

  const result = await verifyIdentity(documentId);
  return res.json({ data: result, error: null });
}));

// ── Revenue ──
adminRouter.get('/revenue', adminAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [totalRevenue, totalTransactions, totalFees] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'payment', status: 'completed' } }),
    prisma.transaction.count({ where: { status: 'completed' } }),
    prisma.transaction.aggregate({ _sum: { fee: true }, where: { type: 'commission', status: 'completed' } }),
  ]);

  return res.json({
    data: { totalRevenue: totalRevenue._sum.amount ?? 0, totalTransactions, totalFees: totalFees._sum.fee ?? 0 },
    error: null,
  });
}));

// ── Admin management (superadmin only) ──
adminRouter.get('/admins', adminAuth, requireSuperAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['admin', 'superadmin', 'verifier'] } },
    select: { id: true, email: true, name: true, lastName: true, role: true, username: true, createdAt: true },
  });
  return res.json({ data: admins, error: null });
}));

adminRouter.post('/admins', adminAuth, requireSuperAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password, name, lastName, role, username } = req.body;
  if (!email || !password || !name || !lastName || !username) {
    return res.status(400).json({ error: 'email, password, name, lastName, username required' });
  }

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (authErr || !authData.user) return res.status(400).json({ error: authErr?.message ?? 'Failed to create auth user' });

  const admin = await prisma.user.create({
    data: { authId: authData.user.id, email, name, lastName, role: role || 'admin', username, documentType: 'cedula' },
    select: { id: true, email: true, name: true, lastName: true, role: true, username: true, createdAt: true },
  });

  return res.status(201).json({ data: admin, error: null });
}));
