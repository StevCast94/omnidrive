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
const wallet_1 = require("../services/wallet");
const verification_1 = require("../services/verification");
const JWT_SECRET = process.env.JWT_SECRET || 'omnidrive_admin_jwt_2026';
exports.adminRouter = (0, express_1.Router)();
// ── Admin Login (no requiere token, usa username + password) ──
exports.adminRouter.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    try {
        // Buscar admin por username
        const admin = await prisma_1.prisma.user.findUnique({ where: { username } });
        if (!admin || !['admin', 'superadmin', 'verifier'].includes(admin.role)) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        // Verificar contraseña contra Supabase Auth
        const { data, error } = await supabase_1.supabase.auth.signInWithPassword({
            email: admin.email,
            password,
        });
        if (error || !data.session) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        // Crear token JWT propio para admin
        const token = jsonwebtoken_1.default.sign({ id: admin.id, role: admin.role, username: admin.username }, JWT_SECRET, { expiresIn: '12h' });
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
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
// ── Verificar token admin ──
exports.adminRouter.get('/auth/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, username: true, name: true, lastName: true, role: true },
        });
        if (!user)
            return res.status(401).json({ error: 'Admin no encontrado' });
        res.json({ ok: true, admin: user });
    }
    catch {
        res.status(401).json({ error: 'Token inválido' });
    }
});
// ── Middleware: proteger TODAS las rutas admin con JWT propio (reemplaza authenticate + requireAdmin) ──
exports.adminRouter.use((req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const allowedRoles = ['admin', 'superadmin', 'verifier'];
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.user = { id: decoded.id, role: decoded.role, email: decoded.username || '' };
        next();
    }
    catch {
        return res.status(401).json({ error: 'Token inválido' });
    }
});
// GET /api/admin/users
exports.adminRouter.get('/users', async (req, res) => {
    const { verified, page = '1', limit = '20', search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (verified !== undefined)
        where.identityVerified = verified === 'true';
    if (search)
        where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { documentId: { contains: search } },
        ];
    try {
        const [users, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, email: true, phone: true, name: true, lastName: true,
                    documentType: true, documentId: true, identityVerified: true,
                    selfieUrl: true, documentFrontUrl: true, documentBackUrl: true,
                    walletBalance: true, subscriptionTier: true, driverScore: true,
                    totalTrips: true, role: true, createdAt: true,
                },
            }),
            prisma_1.prisma.user.count({ where }),
        ]);
        return res.json({ data: { users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/admin/users/:id/verify — Verificar identidad de usuario
exports.adminRouter.put('/users/:id/verify', async (req, res) => {
    try {
        const userId = req.params.id;
        // Auto-validacion basica: verificar cedula con WebServices.ec
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, documentId: true, documentType: true, documentFrontUrl: true, documentBackUrl: true, selfieUrl: true },
        });
        if (!user)
            return res.status(404).json({ data: null, error: 'Usuario no encontrado' });
        let autoValidation = null;
        if (user.documentType === 'cedula' && user.documentId && user.documentId.length === 10) {
            try {
                autoValidation = await (0, verification_1.verifyIdentity)(user.documentId);
            }
            catch (e) {
                autoValidation = null;
            }
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                identityVerified: true,
                verifiedAt: new Date(),
                verifiedBy: req.user.id,
                verificationNotes: autoValidation
                    ? (autoValidation.success
                        ? 'Auto-validacion OK. Datos coinciden con Registro Civil.'
                        : `Auto-validacion fallo. ${autoValidation.error || 'Cedula no valida'}. Verificar manualmente.`)
                    : 'Verificado manualmente por admin.',
            },
        });
        await prisma_1.prisma.notification.create({
            data: {
                userId,
                type: 'identity_verified',
                title: '✅ Identidad verificada',
                body: 'Tu identidad fue verificada. ¡Ya puedes publicar vehículos!',
            },
        });
        return res.json({ data: { ...updated, autoValidation }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/admin/users/:id/reject — Rechazar verificacion con motivo
exports.adminRouter.put('/users/:id/reject', async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ data: null, error: 'reason (motivo de rechazo) es requerido' });
        }
        const updated = await prisma_1.prisma.user.update({
            where: { id: req.params.id },
            data: {
                identityVerified: false,
                verificationNotes: reason,
                verifiedBy: req.user.id,
            },
        });
        await prisma_1.prisma.notification.create({
            data: {
                userId: req.params.id,
                type: 'identity_rejected',
                title: '❌ Verificación rechazada',
                body: `Motivo: ${reason}. Corrige tus documentos y reenvía desde tu perfil.`,
            },
        });
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/admin/vehicles
exports.adminRouter.get('/vehicles', async (req, res) => {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    try {
        const [vehicles, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.vehicle.findMany({
                skip, take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: { owner: { select: { id: true, name: true, email: true } } },
            }),
            prisma_1.prisma.vehicle.count(),
        ]);
        return res.json({ data: { vehicles, total }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/admin/bookings
exports.adminRouter.get('/bookings', async (req, res) => {
    const { status, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (status)
        where.status = status;
    try {
        const [bookings, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.booking.findMany({
                where, skip, take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    vehicle: { select: { brand: true, model: true, plate: true } },
                    tenant: { select: { id: true, name: true, email: true } },
                },
            }),
            prisma_1.prisma.booking.count({ where }),
        ]);
        return res.json({ data: { bookings, total }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/admin/transactions
exports.adminRouter.get('/transactions', async (req, res) => {
    const { type, page = '1', limit = '30' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (type)
        where.type = type;
    try {
        const [transactions, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.transaction.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
            prisma_1.prisma.transaction.count({ where }),
        ]);
        return res.json({ data: { transactions, total }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/admin/disputes
exports.adminRouter.get('/disputes', async (_req, res) => {
    try {
        const disputes = await prisma_1.prisma.booking.findMany({
            where: { status: 'disputed' },
            orderBy: { updatedAt: 'desc' },
            include: {
                vehicle: { select: { brand: true, model: true, plate: true, ownerId: true } },
                tenant: { select: { id: true, name: true, email: true } },
            },
        });
        return res.json({ data: disputes, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/admin/disputes/:id/resolve
exports.adminRouter.put('/disputes/:id/resolve', async (req, res) => {
    const { resolution, refundAmount, faultParty } = req.body;
    if (!resolution)
        return res.status(400).json({ data: null, error: 'resolution required' });
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.status !== 'disputed')
            return res.status(400).json({ data: null, error: 'Booking is not in disputed status' });
        // Refund tenant if fault is owner's, or partial refund
        if (refundAmount && refundAmount > 0) {
            await (0, wallet_1.refundPayment)(booking.id, booking.tenantId, parseFloat(refundAmount));
        }
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: {
                status: 'completed',
                damageReport: {
                    ...(booking.damageReport ?? {}),
                    resolution,
                    faultParty,
                    refundAmount,
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: req.user.id,
                },
            },
        });
        // Notify both parties
        await prisma_1.prisma.notification.createMany({
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
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════
// BANNED IDENTITIES
// ═══════════════════════════════════════════════════════════════════════
// GET /api/admin/banned-identities
exports.adminRouter.get('/banned-identities', async (req, res) => {
    const { page = '1', limit = '20', active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (active !== undefined)
        where.active = active === 'true';
    try {
        const [items, total] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.bannedIdentity.findMany({
                where, skip, take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.bannedIdentity.count({ where }),
        ]);
        return res.json({
            data: { items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
            error: null,
        });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/admin/banned-identities
exports.adminRouter.post('/banned-identities', async (req, res) => {
    const { documentId, reason } = req.body;
    if (!documentId || !reason) {
        return res.status(400).json({ data: null, error: 'documentId y reason son requeridos' });
    }
    try {
        // Si ya existe, reactivar
        const existing = await prisma_1.prisma.bannedIdentity.findUnique({ where: { documentId } });
        if (existing) {
            const updated = await prisma_1.prisma.bannedIdentity.update({
                where: { documentId },
                data: { active: true, reason, bannedBy: req.user.id },
            });
            return res.json({ data: updated, error: null });
        }
        const banned = await prisma_1.prisma.bannedIdentity.create({
            data: { documentId, reason, bannedBy: req.user.id },
        });
        // Desverificar al usuario si tenía esa cédula
        await prisma_1.prisma.user.updateMany({
            where: { documentId, identityVerified: true },
            data: { identityVerified: false, verifiedAt: null },
        });
        return res.status(201).json({ data: banned, error: null });
    }
    catch (e) {
        if (e.code === 'P2002') {
            return res.status(409).json({ data: null, error: 'Esta cédula ya está vetada' });
        }
        return res.status(500).json({ data: null, error: e.message });
    }
});
// DELETE /api/admin/banned-identities/:id — desactivar veto
exports.adminRouter.delete('/banned-identities/:id', async (req, res) => {
    try {
        const banned = await prisma_1.prisma.bannedIdentity.update({
            where: { id: req.params.id },
            data: { active: false },
        });
        return res.json({ data: banned, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/admin/verify-cedula — endpoint admin para verificar una cédula manualmente
exports.adminRouter.post('/verify-cedula', async (req, res) => {
    const { documentId } = req.body;
    if (!documentId) {
        return res.status(400).json({ data: null, error: 'documentId es requerido' });
    }
    try {
        const result = await (0, verification_1.verifyIdentity)(documentId);
        return res.json({ data: result, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// DELETE /api/admin/users/:id — Eliminar usuario completo (DB + Supabase Auth)
exports.adminRouter.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        // 1. Obtener usuario para saber su authId
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, authId: true, email: true, name: true },
        });
        if (!user)
            return res.status(404).json({ data: null, error: 'Usuario no encontrado' });
        // 2. Verificar que no tenga bookings activos
        const activeBooking = await prisma_1.prisma.booking.findFirst({
            where: { OR: [{ tenantId: userId }, { vehicle: { ownerId: userId } }], status: { in: ['active', 'confirmed'] } },
        });
        if (activeBooking) {
            return res.status(409).json({ data: null, error: 'El usuario tiene reservas activas. Cancélalas antes de eliminar.' });
        }
        // 3. Eliminar registros relacionados en orden (evitar FK constraints)
        // Nota: los where se pasan explícitamente para evitar ambigüedad de tipos en $transaction
        // Primero obtener IDs de bookings a eliminar para limpiar reviews antes
        const vehicleIds = (await prisma_1.prisma.vehicle.findMany({ where: { ownerId: userId }, select: { id: true } })).map(v => v.id);
        const bookingIds = (await prisma_1.prisma.booking.findMany({
            where: { OR: [{ vehicleId: { in: vehicleIds } }, { tenantId: userId }] },
            select: { id: true },
        })).map(b => b.id);
        await prisma_1.prisma.$transaction([
            // Reviews vinculadas a esos bookings
            ...(bookingIds.length > 0
                ? [prisma_1.prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } })]
                : []),
            // Reviews del usuario como autor (si no se cubrieron arriba)
            prisma_1.prisma.review.deleteMany({ where: { authorId: userId } }),
            // Notificaciones
            prisma_1.prisma.notification.deleteMany({ where: { userId: userId } }),
            prisma_1.prisma.userDocument.deleteMany({ where: { userId: userId } }),
            prisma_1.prisma.subscription.deleteMany({ where: { userId: userId } }),
            // Bookings de vehículos del usuario
            ...(vehicleIds.length > 0
                ? [prisma_1.prisma.booking.deleteMany({ where: { vehicleId: { in: vehicleIds } } })]
                : []),
            // Vehículos del usuario
            prisma_1.prisma.vehicle.deleteMany({ where: { ownerId: userId } }),
            // Bookings donde es tenant
            prisma_1.prisma.booking.deleteMany({ where: { tenantId: userId } }),
            // Transacciones
            prisma_1.prisma.transaction.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
            // Finalmente el usuario
            prisma_1.prisma.user.delete({ where: { id: userId } }),
        ]);
        // 4. Eliminar de Supabase Auth
        const { error: supabaseErr } = await supabase_1.supabase.auth.admin.deleteUser(user.authId);
        if (supabaseErr) {
            console.warn('[admin delete-user] Supabase deletion warning:', supabaseErr.message);
            // No fallamos — el usuario ya fue eliminado de nuestra DB
        }
        return res.json({ data: { deleted: true, email: user.email }, error: null });
    }
    catch (e) {
        console.error('[admin delete-user] Error:', e.message);
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/admin/metrics
exports.adminRouter.get('/metrics', async (_req, res) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalUsers, verifiedUsers, totalVehicles, activeBookings, revenueToday, revenueMonth, disputeCount,] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.user.count(),
            prisma_1.prisma.user.count({ where: { identityVerified: true } }),
            prisma_1.prisma.vehicle.count(),
            prisma_1.prisma.booking.count({ where: { status: 'active' } }),
            prisma_1.prisma.transaction.aggregate({
                where: { type: 'commission', status: 'completed', createdAt: { gte: startOfDay } },
                _sum: { amount: true },
            }),
            prisma_1.prisma.transaction.aggregate({
                where: { type: 'commission', status: 'completed', createdAt: { gte: startOfMonth } },
                _sum: { amount: true },
            }),
            prisma_1.prisma.booking.count({ where: { status: 'disputed' } }),
        ]);
        // Occupancy: active / total available
        const availableVehicles = await prisma_1.prisma.vehicle.count({ where: { available: true } });
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
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// ── Superadmin: Admin management ──
exports.adminRouter.get('/admins', async (req, res) => {
    try {
        const admins = await prisma_1.prisma.user.findMany({
            where: { role: { in: ['admin', 'superadmin', 'verifier'] } },
            select: { id: true, email: true, name: true, lastName: true, role: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        return res.json({ data: admins, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
exports.adminRouter.post('/create-admin', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ data: null, error: 'email, password y role requeridos' });
    }
    if (!['admin', 'verifier'].includes(role)) {
        return res.status(400).json({ data: null, error: 'Role debe ser admin o verifier' });
    }
    try {
        const { data: authData, error: authErr } = await supabase_1.supabase.auth.admin.createUser({
            email, password, email_confirm: true,
        });
        if (authErr)
            return res.status(400).json({ data: null, error: authErr.message });
        const name = email.split('@')[0];
        const user = await prisma_1.prisma.user.create({
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
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
exports.adminRouter.delete('/delete-admin/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const target = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!target)
            return res.status(404).json({ data: null, error: 'No encontrado' });
        if (target.role === 'superadmin') {
            return res.status(403).json({ data: null, error: 'No puedes eliminar al superadmin' });
        }
        await supabase_1.supabase.auth.admin.deleteUser(target.authId);
        await prisma_1.prisma.user.delete({ where: { id: userId } });
        return res.json({ data: { deleted: userId }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=admin.js.map