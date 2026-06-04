"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const supabase_1 = require("../lib/supabase");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verification_1 = require("../services/verification");
const asyncHandler_1 = require("../middleware/asyncHandler");
const env_1 = require("../config/env");
const rateLimit_1 = require("../middleware/rateLimit");
const JWT_SECRET = env_1.env.JWT_SECRET;
exports.adminRouter = (0, express_1.Router)();
// ── Admin Login (JWT propio, no Supabase) ──
exports.adminRouter.post('/auth/login', rateLimit_1.authLimiter, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Usuario y contrasena requeridos' });
    const admin = await prisma_1.prisma.user.findUnique({ where: { username } });
    if (!admin || admin.role === 'user')
        return res.status(401).json({ error: 'Credenciales invalidas' });
    // Validate password against Supabase Auth
    const { error: signInErr } = await supabase_1.supabase.auth.signInWithPassword({ email: admin.email, password });
    if (signInErr)
        return res.status(401).json({ error: 'Credenciales invalidas' });
    const token = jsonwebtoken_1.default.sign({ role: admin.role, id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({
        data: {
            token,
            user: { id: admin.id, email: admin.email, name: admin.name, lastName: admin.lastName, role: admin.role, username: admin.username },
        },
        error: null,
    });
}));
// ── Auth middleware for admin (JWT propio) ──
function adminAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Token requerido' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Token invalido o expirado' });
    }
}
function requireSuperAdmin(req, res, next) {
    if (req.user?.role !== 'superadmin')
        return res.status(403).json({ error: 'Solo superadmin' });
    next();
}
// ── Auth verify (validar sesión) ──
exports.adminRouter.get('/auth/verify', adminAuth, (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    return res.json({ ok: true, error: null });
}));
// ── Dashboard stats ──
exports.adminRouter.get('/dashboard', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [totalUsers, verifiedUsers, totalVehicles, totalBookings, pendingVerifications, activeBookings, disputedBookings, revenueTotal, revenueToday, revenueMonth, recentUsers, recentBookings,] = await Promise.all([
        prisma_1.prisma.user.count(),
        prisma_1.prisma.user.count({ where: { identityVerified: true } }),
        prisma_1.prisma.vehicle.count(),
        prisma_1.prisma.booking.count(),
        prisma_1.prisma.user.count({ where: { identityVerified: false, selfieUrl: { not: null } } }),
        prisma_1.prisma.booking.count({ where: { status: 'active' } }),
        prisma_1.prisma.booking.count({ where: { status: 'disputed' } }),
        prisma_1.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'payment', status: 'completed' } }),
        prisma_1.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'payment', status: 'completed', createdAt: { gte: today } } }),
        prisma_1.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'payment', status: 'completed', createdAt: { gte: monthStart } } }),
        prisma_1.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, lastName: true, email: true, role: true, identityVerified: true, createdAt: true } }),
        prisma_1.prisma.booking.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { vehicle: { select: { brand: true, model: true } }, tenant: { select: { name: true, lastName: true } } } }),
    ]);
    const occupancyRate = totalVehicles > 0 ? Math.round((activeBookings / totalVehicles) * 100) : 0;
    return res.json({ data: {
            totalUsers, verifiedUsers, totalVehicles, totalBookings, pendingVerifications,
            activeBookings, openDisputes: disputedBookings, occupancyRate,
            revenue: revenueTotal._sum.amount ?? 0,
            revenueToday: revenueToday._sum.amount ?? 0,
            revenueMonth: revenueMonth._sum.amount ?? 0,
            recentUsers, recentBookings,
        }, error: null });
}));
// ── Users CRUD ──
exports.adminRouter.get('/users', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { search, role, verified, page = '1', limit = '20' } = req.query;
    const where = {};
    if (role)
        where.role = role;
    if (verified === 'true')
        where.identityVerified = true;
    if (verified === 'false')
        where.identityVerified = false;
    if (search)
        where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { documentId: { contains: search } }];
    const [users, total] = await Promise.all([
        prisma_1.prisma.user.findMany({
            where,
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, name: true, lastName: true, phone: true, documentType: true, documentId: true, role: true, identityVerified: true, verificationNotes: true, avatarUrl: true, walletBalance: true, subscriptionTier: true, rating: true, totalTrips: true, createdAt: true, birthDate: true, gender: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true },
        }),
        prisma_1.prisma.user.count({ where }),
    ]);
    return res.json({ data: { users, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
}));
exports.adminRouter.get('/users/:id', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, email: true, name: true, lastName: true, phone: true, documentType: true, documentId: true, gender: true, birthDate: true, role: true, identityVerified: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true, verificationNotes: true, avatarUrl: true, walletBalance: true, subscriptionTier: true, rating: true, totalTrips: true, createdAt: true, updatedAt: true },
    });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    return res.json({ data: user, error: null });
}));
exports.adminRouter.put('/users/:id/role', adminAuth, requireSuperAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { role, username, name, lastName, password } = req.body;
    const data = {};
    if (role)
        data.role = role;
    if (username)
        data.username = username;
    if (name)
        data.name = name;
    if (lastName)
        data.lastName = lastName;
    const updated = await prisma_1.prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, email: true, name: true, lastName: true, role: true, username: true } });
    if (password) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: req.params.id } });
        if (user) {
            await supabase_1.supabase.auth.admin.updateUserById(user.authId, { password }).catch(e => console.warn('[admin] Password update warning:', e.message));
        }
    }
    return res.json({ data: updated, error: null });
}));
exports.adminRouter.put('/users/:id/verify', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { verified, notes } = req.body;
    const updated = await prisma_1.prisma.user.update({
        where: { id: req.params.id },
        data: { identityVerified: verified, selfieUrl: verified ? undefined : null, documentFrontUrl: verified ? undefined : null, documentBackUrl: verified ? undefined : null, verificationNotes: notes || null, verifiedBy: req.user.id, verifiedAt: verified ? new Date() : undefined },
        select: { id: true, name: true, lastName: true, identityVerified: true, verificationNotes: true, verifiedAt: true },
    });
    if (verified) {
        await prisma_1.prisma.notification.create({
            data: {
                userId: req.params.id,
                type: 'identity_verified',
                title: '¡Identidad verificada!',
                body: 'Tu documento fue aprobado. Ya puedes publicar vehículos y reservar.',
            },
        });
    }
    return res.json({ data: updated, error: null });
}));
exports.adminRouter.delete('/users/:id', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const user = await prisma_1.prisma.user.findUnique({ where: { id } });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    // Delete related data in order
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.notification.deleteMany({ where: { userId: id } }),
        prisma_1.prisma.message.deleteMany({ where: { senderId: id } }),
        prisma_1.prisma.conversation.deleteMany({ where: { userIds: { has: id } } }),
        prisma_1.prisma.review.deleteMany({ where: { OR: [{ authorId: id }, { targetId: id }] } }),
        prisma_1.prisma.transaction.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
        prisma_1.prisma.subscription.deleteMany({ where: { userId: id } }),
        prisma_1.prisma.userDocument.deleteMany({ where: { userId: id } }),
        prisma_1.prisma.booking.deleteMany({ where: { OR: [{ tenantId: id }, { renterId: id }] } }),
        prisma_1.prisma.vehicle.deleteMany({ where: { ownerId: id } }),
        prisma_1.prisma.user.delete({ where: { id } }),
    ]);
    // Try to delete from Supabase Auth (non-critical)
    supabase_1.supabase.auth.admin.deleteUser(user.authId).catch(e => console.warn('[admin] Supabase deletion warning:', e.message));
    return res.json({ data: { deleted: true }, error: null });
}));
// ── Vehicles CRUD ──
exports.adminRouter.get('/vehicles', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { search, page = '1', limit = '20' } = req.query;
    const where = {};
    if (search)
        where.OR = [{ brand: { contains: search, mode: 'insensitive' } }, { model: { contains: search, mode: 'insensitive' } }, { plate: { contains: search, mode: 'insensitive' } }];
    const [vehicles, total] = await Promise.all([
        prisma_1.prisma.vehicle.findMany({
            where, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include: { owner: { select: { id: true, name: true, lastName: true, email: true } }, _count: { select: { bookings: true } } },
        }),
        prisma_1.prisma.vehicle.count({ where }),
    ]);
    return res.json({ data: { vehicles, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
}));
// ── Bookings CRUD ──
exports.adminRouter.get('/bookings', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { status, page = '1', limit = '20' } = req.query;
    const where = {};
    if (status)
        where.status = status;
    const [bookings, total] = await Promise.all([
        prisma_1.prisma.booking.findMany({
            where, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include: { vehicle: { select: { id: true, brand: true, model: true, plate: true } }, tenant: { select: { id: true, name: true, lastName: true } } },
        }),
        prisma_1.prisma.booking.count({ where }),
    ]);
    return res.json({ data: { bookings, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
}));
// ── Banned Identities ──
exports.adminRouter.get('/banned-identities', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const bans = await prisma_1.prisma.bannedIdentity.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ data: bans, error: null });
}));
exports.adminRouter.post('/banned-identities', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { documentId, reason } = req.body;
    if (!documentId || !reason)
        return res.status(400).json({ error: 'documentId and reason required' });
    const existing = await prisma_1.prisma.bannedIdentity.findUnique({ where: { documentId } });
    if (existing)
        return res.status(409).json({ error: 'Already banned' });
    const ban = await prisma_1.prisma.bannedIdentity.create({ data: { documentId, reason, bannedBy: req.user.id } });
    return res.json({ data: ban, error: null });
}));
exports.adminRouter.delete('/banned-identities/:id', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.bannedIdentity.update({ where: { id: req.params.id }, data: { active: false } });
    return res.json({ data: { unbanned: true }, error: null });
}));
// ── Verification ──
exports.adminRouter.post('/verify-cedula', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { documentId } = req.body;
    if (!documentId)
        return res.status(400).json({ error: 'documentId required' });
    const result = await (0, verification_1.verifyIdentity)(documentId);
    return res.json({ data: result, error: null });
}));
// ── Revenue ──
exports.adminRouter.get('/revenue', adminAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const [totalRevenue, totalTransactions, totalFees] = await Promise.all([
        prisma_1.prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'payment', status: 'completed' } }),
        prisma_1.prisma.transaction.count({ where: { status: 'completed' } }),
        prisma_1.prisma.transaction.aggregate({ _sum: { fee: true }, where: { type: 'commission', status: 'completed' } }),
    ]);
    return res.json({
        data: { totalRevenue: totalRevenue._sum.amount ?? 0, totalTransactions, totalFees: totalFees._sum.fee ?? 0 },
        error: null,
    });
}));
// ── Admin management (superadmin only) ──
exports.adminRouter.get('/admins', adminAuth, requireSuperAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const admins = await prisma_1.prisma.user.findMany({
        where: { role: { in: ['admin', 'superadmin', 'verifier'] } },
        select: { id: true, email: true, name: true, lastName: true, role: true, username: true, createdAt: true },
    });
    return res.json({ data: admins, error: null });
}));
exports.adminRouter.post('/admins', adminAuth, requireSuperAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password, name, lastName, role, username } = req.body;
    if (!email || !password || !name || !lastName || !username) {
        return res.status(400).json({ error: 'email, password, name, lastName, username required' });
    }
    const { data: authData, error: authErr } = await supabase_1.supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authErr || !authData.user)
        return res.status(400).json({ error: authErr?.message ?? 'Failed to create auth user' });
    const admin = await prisma_1.prisma.user.create({
        data: { authId: authData.user.id, email, name, lastName, role: role || 'admin', username, documentType: 'cedula' },
        select: { id: true, email: true, name: true, lastName: true, role: true, username: true, createdAt: true },
    });
    return res.status(201).json({ data: admin, error: null });
}));
//# sourceMappingURL=admin.js.map