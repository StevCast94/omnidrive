"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireVerified = exports.requireSuperAdmin = exports.requireAdmin = exports.authenticate = void 0;
const prisma_1 = require("../lib/prisma");
const supabase_1 = require("../lib/supabase");
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ data: null, error: 'No token provided' });
    // Validate token with Supabase Auth
    const { data: { user: authUser }, error } = await supabase_1.supabase.auth.getUser(token);
    if (error || !authUser)
        return res.status(401).json({ data: null, error: 'Invalid or expired token' });
    // Look up our app user by Supabase auth UUID
    const user = await prisma_1.prisma.user.findUnique({
        where: { authId: authUser.id },
        select: { id: true, role: true, email: true },
    });
    if (!user)
        return res.status(401).json({ data: null, error: 'User profile not found' });
    req.user = user;
    next();
};
exports.authenticate = authenticate;
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin' && req.user?.role !== 'verifier')
        return res.status(403).json({ data: null, error: 'Admin access required' });
    next();
};
exports.requireAdmin = requireAdmin;
const requireSuperAdmin = (req, res, next) => {
    if (req.user?.role !== 'superadmin')
        return res.status(403).json({ data: null, error: 'Superadmin access required' });
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
const requireVerified = async (req, res, next) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { identityVerified: true },
    });
    if (!user?.identityVerified)
        return res.status(403).json({ data: null, error: 'Identity verification required' });
    next();
};
exports.requireVerified = requireVerified;
//# sourceMappingURL=auth.js.map