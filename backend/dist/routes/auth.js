"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const prisma_1 = require("../lib/prisma");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const storage_1 = require("../lib/storage");
const verification_1 = require("../services/verification");
const asyncHandler_1 = require("../middleware/asyncHandler");
const rateLimit_1 = require("../middleware/rateLimit");
function validarCedulaEcuatoriana(cedula) {
    if (!/^\d{10}$/.test(cedula))
        return false;
    const digitoVerificador = parseInt(cedula[9], 10);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cedula[i], 10);
        if (i % 2 === 0) {
            valor *= 2;
            if (valor > 9)
                valor -= 9;
        }
        suma += valor;
    }
    return ((10 - (suma % 10)) % 10) === digitoVerificador;
}
exports.authRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
// POST /api/auth/register
exports.authRouter.post('/register', rateLimit_1.authLimiter, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, phone, password, name, lastName, documentType, documentId, birthDate } = req.body;
    if (!email || !phone || !password || !name || !lastName || !documentType || !documentId) {
        return res.status(400).json({ data: null, error: 'Missing required fields' });
    }
    const existing = await prisma_1.prisma.user.findFirst({
        where: { OR: [{ email }, { phone }, { documentId }] },
    });
    if (existing)
        return res.status(409).json({ data: null, error: 'User already exists' });
    const { data: authData, error: authErr } = await supabase_1.supabase.auth.admin.createUser({
        email, password, phone,
        email_confirm: true,
        user_metadata: { name, lastName },
    });
    if (authErr || !authData.user) {
        return res.status(400).json({ data: null, error: authErr?.message ?? 'Auth creation failed' });
    }
    const user = await prisma_1.prisma.user.create({
        data: {
            authId: authData.user.id,
            email, phone, name, lastName, documentType, documentId,
            birthDate: birthDate ? new Date(birthDate) : undefined,
        },
        select: {
            id: true, authId: true, email: true, phone: true,
            name: true, lastName: true, role: true,
            avatarUrl: true, identityVerified: true,
            walletBalance: true, subscriptionTier: true,
            rating: true, createdAt: true,
        },
    });
    return res.status(201).json({ data: { user }, error: null });
}));
// POST /api/auth/verify-identity
exports.authRouter.post('/verify-identity', auth_1.authenticate, upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
]), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const files = req.files;
    if (!files?.selfie || !files?.documentFront || !files?.documentBack) {
        return res.status(400).json({ data: null, error: 'selfie, documentFront and documentBack are required' });
    }
    const uid = req.user.id;
    const [selfieUrl, documentFrontUrl, documentBackUrl] = await Promise.all([
        (0, storage_1.uploadToStorage)(`identity/${uid}/selfie`, files.selfie[0]),
        (0, storage_1.uploadToStorage)(`identity/${uid}/doc-front`, files.documentFront[0]),
        (0, storage_1.uploadToStorage)(`identity/${uid}/doc-back`, files.documentBack[0]),
    ]);
    const user = await prisma_1.prisma.user.update({
        where: { id: uid },
        data: { selfieUrl, documentFrontUrl, documentBackUrl, verificationNotes: null },
        select: { id: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true, identityVerified: true, verificationNotes: true },
    });
    return res.json({ data: { user, message: 'Documents uploaded. Pending manual review.' }, error: null });
}));
// GET /api/auth/me
exports.authRouter.get('/me', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true, authId: true, email: true, phone: true,
            name: true, lastName: true, documentType: true, documentId: true,
            birthDate: true, gender: true, avatarUrl: true, identityVerified: true,
            selfieUrl: true, documentFrontUrl: true, documentBackUrl: true,
            verificationNotes: true, verifiedAt: true,
            walletBalance: true, subscriptionTier: true, subscriptionEnds: true,
            rating: true, totalTrips: true, role: true,
            createdAt: true, documents: true,
        },
    });
    if (!user)
        return res.status(404).json({ data: null, error: 'User not found' });
    return res.json({ data: user, error: null });
}));
// POST /api/auth/oauth-profile
exports.authRouter.post('/oauth-profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return res.status(401).json({ data: null, error: 'No token provided' });
    const { data: { user: authUser }, error: authErr } = await supabase_1.supabase.auth.getUser(token);
    if (authErr || !authUser)
        return res.status(401).json({ data: null, error: 'Invalid or expired token' });
    const existing = await prisma_1.prisma.user.findUnique({ where: { authId: authUser.id } });
    if (existing)
        return res.json({ data: existing, error: null });
    const email = authUser.email || '';
    const userMeta = authUser.user_metadata || {};
    const fullName = userMeta.full_name || userMeta.name || '';
    const nameParts = fullName.split(' ');
    const name = nameParts[0] || email.split('@')[0] || 'Usuario';
    const lastName = nameParts.slice(1).join(' ') || '';
    const phone = authUser.phone || userMeta.phone || null;
    const picture = userMeta.picture || userMeta.avatar_url || null;
    const user = await prisma_1.prisma.user.create({
        data: {
            authId: authUser.id, email, phone, name, lastName,
            documentType: 'cedula',
            avatarUrl: picture,
        },
        select: {
            id: true, authId: true, email: true, phone: true,
            name: true, lastName: true, documentType: true, documentId: true,
            avatarUrl: true, role: true, identityVerified: true,
            walletBalance: true, subscriptionTier: true, rating: true, createdAt: true,
        },
    });
    return res.status(201).json({ data: user, error: null });
}));
// POST /api/auth/verificar-cedula
exports.authRouter.post('/verificar-cedula', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { documentId } = req.body;
    if (!documentId)
        return res.status(400).json({ data: null, error: 'documentId es requerido' });
    const banned = await prisma_1.prisma.bannedIdentity.findUnique({ where: { documentId, active: true } });
    if (banned)
        return res.status(403).json({ data: null, error: 'Esta cedula ha sido vetada en la plataforma.', code: 'BANNED_IDENTITY' });
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (user && user.documentId !== documentId && user.identityVerified) {
        return res.status(400).json({ data: null, error: 'Ya tienes una identidad verificada con otro documento.', code: 'ALREADY_VERIFIED' });
    }
    const existingUser = await prisma_1.prisma.user.findUnique({ where: { documentId } });
    if (existingUser && existingUser.id !== req.user.id) {
        return res.status(409).json({ data: null, error: 'Esta cedula ya esta registrada por otro usuario.', code: 'DOCUMENT_IN_USE' });
    }
    const provider = (0, verification_1.getProvider)();
    let nombres, apellidos, estado, provedor;
    if (provider) {
        const result = await (0, verification_1.verifyIdentity)(documentId);
        if (!result.success) {
            return res.status(400).json({
                data: { result },
                error: `La cedula no pudo ser verificada: ${result.error || 'Cedula invalida o no encontrada'}`,
                code: 'VERIFICATION_FAILED',
            });
        }
        nombres = result.nombres;
        apellidos = result.apellidos;
        estado = result.estado;
        provedor = result.provedor;
    }
    else {
        const valida = validarCedulaEcuatoriana(documentId);
        if (!valida) {
            return res.status(400).json({ data: null, error: 'El numero de cedula no es valido.', code: 'VERIFICATION_FAILED' });
        }
        nombres = user?.name || 'Usuario';
        apellidos = user?.lastName || 'Verificado';
        estado = 'ACTIVA';
        provedor = 'offline';
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data: {
            documentId,
            name: nombres.split(' ')[0] || user?.name || nombres,
            lastName: apellidos || user?.lastName || '',
            identityVerified: true,
            verifiedAt: new Date(),
        },
        select: { id: true, name: true, lastName: true, documentId: true, identityVerified: true, verifiedAt: true },
    });
    await prisma_1.prisma.notification.create({
        data: {
            userId: req.user.id,
            type: 'identity_verified',
            title: 'Identidad verificada',
            body: `Tu cedula ${documentId} ha sido verificada exitosamente.`,
            data: { documentId, provedor },
        },
    });
    return res.json({
        data: { user: updated, verification: { nombres, apellidos, estado, provedor } },
        error: null,
    });
}));
// POST /api/auth/verificar-whatsapp
exports.authRouter.post('/verificar-whatsapp', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { phone } = req.body;
    if (!phone)
        return res.status(400).json({ data: null, error: 'Numero de telefono requerido' });
    const clean = phone.replace(/[^\d]/g, '');
    const fullNumber = clean.startsWith('593') ? clean : '593' + clean.replace(/^0+/, '');
    if (fullNumber.length < 11 || fullNumber.length > 13) {
        return res.status(400).json({ data: null, error: 'Numero de telefono invalido.' });
    }
    const provider = (0, verification_1.getProvider)();
    if (!provider?.verificarWhatsApp) {
        return res.status(500).json({ data: null, error: 'Servicio de verificacion WhatsApp no disponible.' });
    }
    const result = await provider.verificarWhatsApp(fullNumber);
    return res.json({ data: { phone: fullNumber, exists: result.exists, whatsapp: result.whatsapp }, error: result.error || null });
}));
// PUT /api/auth/me
exports.authRouter.put('/me', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, lastName, phone, gender, birthDate, documentType, documentId } = req.body;
    const data = {};
    if (name !== undefined)
        data.name = name;
    if (lastName !== undefined)
        data.lastName = lastName;
    if (phone !== undefined)
        data.phone = phone || null;
    if (gender !== undefined)
        data.gender = gender;
    if (documentType !== undefined)
        data.documentType = documentType;
    if (documentId !== undefined)
        data.documentId = documentId || null;
    if (birthDate !== undefined)
        data.birthDate = birthDate ? new Date(birthDate) : null;
    const user = await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data,
        select: { id: true, email: true, phone: true, name: true, lastName: true, documentType: true, documentId: true, avatarUrl: true, gender: true, birthDate: true, updatedAt: true },
    });
    return res.json({ data: user, error: null });
}));
// POST /api/auth/avatar
const avatarUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowed.includes(file.mimetype))
            cb(null, true);
        else
            cb(new Error('Formato no soportado. Usa: jpg, png, webp, gif'));
    },
});
exports.authRouter.post('/avatar', auth_1.authenticate, avatarUpload.single('avatar'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        return res.status(400).json({ data: null, error: 'No se envio ninguna imagen' });
    const uid = req.user.id;
    const buffer = req.file.buffer;
    const { v2: cloudinary } = require('cloudinary');
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder: 'omnidrive/avatars',
            public_id: 'avatar-' + uid,
            overwrite: true,
            transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto:best', format: 'webp' }],
        }, (err, res) => (err ? reject(err) : resolve(res)));
        stream.end(buffer);
    });
    const avatarUrl = result.secure_url.replace('/upload/', '/upload/q_auto:best,f_auto,w_400/');
    await prisma_1.prisma.user.update({ where: { id: uid }, data: { avatarUrl } });
    return res.json({ data: { avatarUrl }, error: null });
}));
//# sourceMappingURL=auth.js.map