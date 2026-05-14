import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { supabase } from '../lib/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';
import { verifyIdentity, getProvider } from '../services/verification';

export const authRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/auth/register
// Frontend sends credentials + profile data.
// Backend creates Supabase Auth user, then inserts User row with authId.
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, phone, password, name, lastName, documentType, documentId, birthDate } = req.body;

  if (!email || !phone || !password || !name || !lastName || !documentType || !documentId)
    return res.status(400).json({ data: null, error: 'Missing required fields' });

  try {
    // 1. Check uniqueness in our DB before hitting Supabase
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }, { documentId }] },
    });
    if (existing) return res.status(409).json({ data: null, error: 'User already exists' });

    // 2. Create Supabase Auth user (admin API — no email confirmation needed for MVP)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      phone,
      email_confirm: true,   // skip email confirmation in MVP
      user_metadata: { name, lastName },
    });
    if (authErr || !authData.user)
      return res.status(400).json({ data: null, error: authErr?.message ?? 'Auth creation failed' });

    // 3. Create our User row linked to the Supabase UID
    const user = await prisma.user.create({
      data: {
        authId: authData.user.id,
        email, phone, name, lastName, documentType, documentId,
        birthDate: birthDate ? new Date(birthDate) : undefined,
      },
      select: {
        id: true, authId: true, email: true, phone: true,
        name: true, lastName: true, role: true,
        identityVerified: true, walletBalance: true,
        subscriptionTier: true, driverScore: true, createdAt: true,
      },
    });

    // 4. Return the user profile (frontend will sign in separately to get the session token)
    return res.status(201).json({ data: { user }, error: null });
  } catch (e: any) {
    console.error('[PUT /me] Error:', e.message);
    if (e.code === 'P2002') {
      const target = e.meta?.target?.join(', ') || 'campo único';
      return res.status(409).json({ data: null, error: `Ya existe otro usuario con ese ${target}` });
    }
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/auth/verify-identity — multipart upload
authRouter.post(
  '/verify-identity',
  authenticate,
  upload.fields([
    { name: 'selfie',        maxCount: 1 },
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack',  maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]>;
    if (!files?.selfie || !files?.documentFront || !files?.documentBack)
      return res.status(400).json({ data: null, error: 'selfie, documentFront and documentBack are required' });

    try {
      const uid = req.user!.id;
      const [selfieUrl, documentFrontUrl, documentBackUrl] = await Promise.all([
        uploadToStorage(`identity/${uid}/selfie`,    files.selfie[0]),
        uploadToStorage(`identity/${uid}/doc-front`, files.documentFront[0]),
        uploadToStorage(`identity/${uid}/doc-back`,  files.documentBack[0]),
      ]);

      const user = await prisma.user.update({
        where: { id: uid },
        data: { selfieUrl, documentFrontUrl, documentBackUrl },
        select: { id: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true, identityVerified: true },
      });

      return res.json({ data: { user, message: 'Documents uploaded. Pending manual review.' }, error: null });
    } catch (e: any) {
      return res.status(500).json({ data: null, error: e.message });
    }
  }
);

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, authId: true, email: true, phone: true,
        name: true, lastName: true, documentType: true, documentId: true,
        birthDate: true, gender: true, identityVerified: true, selfieUrl: true,
        walletBalance: true, subscriptionTier: true, subscriptionEnds: true,
        driverScore: true, totalTrips: true, totalKm: true, role: true,
        createdAt: true, documents: true,
      },
    });
    if (!user) return res.status(404).json({ data: null, error: 'User not found' });
    return res.json({ data: user, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/auth/oauth-profile — Crea perfil en DB para usuarios que ya existen en Auth (OAuth)
// DIFERENTE a /register: este no intenta crear en Supabase Auth, solo en Prisma.
// El middleware authenticate no puede usarse porque busca perfil en DB.
// En su lugar verificamos el token manualmente.
authRouter.post('/oauth-profile', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ data: null, error: 'No token provided' });
    
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) return res.status(401).json({ data: null, error: 'Invalid or expired token' });

    // Verificar si ya existe perfil en nuestra DB
    const existing = await prisma.user.findUnique({ where: { authId: authUser.id } });
    if (existing) return res.json({ data: existing, error: null });

    const email = authUser.email || '';
    const userMeta = authUser.user_metadata || {};
    const fullName = userMeta.full_name || userMeta.name || '';
    const nameParts = fullName.split(' ');
    const name = nameParts[0] || email.split('@')[0] || 'Usuario';
    const lastName = nameParts.slice(1).join(' ') || '';
    const phone = authUser.phone || userMeta.phone || '0000000000';
    const picture = userMeta.picture || userMeta.avatar_url || '';

    // Log para debug
    console.log('[oauth-profile] Creating user:', { name, lastName, email, phone: phone.substring(0,10), authId: authUser.id });

    const userId = authUser.id.replace(/-/g, '').substring(0, 20);
    const user = await prisma.user.create({
      data: {
        authId: authUser.id,
        email,
        phone: phone.length >= 10 ? phone : ('0000000000'),
        name,
        lastName,
        documentType: 'cedula',
        documentId: 'oauth-' + userId,
        // avatarUrl no existe en el schema Prisma aún
      },
      select: {
        id: true, authId: true, email: true, phone: true,
        name: true, lastName: true, documentType: true, documentId: true,
        role: true,
        identityVerified: true, walletBalance: true,
        subscriptionTier: true, driverScore: true, createdAt: true,
      },
    });

    return res.status(201).json({ data: user, error: null });
  } catch (e: any) {
    console.error('[oauth-profile] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message, detail: e.stack?.split('\n').slice(0,3).join(' | ') });
  }
});

// POST /api/auth/verificar-cedula — Verifica cédula contra proveedor real (WebServices.ec)
authRouter.post('/verificar-cedula', authenticate, async (req: AuthRequest, res: Response) => {
  const { documentId } = req.body;
  if (!documentId) {
    return res.status(400).json({ data: null, error: 'documentId es requerido' });
  }

  try {
    // 1. Verificar si la cédula está vetada
    const banned = await prisma.bannedIdentity.findUnique({
      where: { documentId, active: true },
    });
    if (banned) {
      return res.status(403).json({
        data: null,
        error: 'Esta cédula ha sido vetada en la plataforma.',
        code: 'BANNED_IDENTITY',
      });
    }

    // 2. Verificar si el usuario ya tiene una cédula diferente
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (user && user.documentId !== documentId && user.identityVerified) {
      return res.status(400).json({
        data: null,
        error: 'Ya tienes una identidad verificada con otro documento.',
        code: 'ALREADY_VERIFIED',
      });
    }

    // 3. Verificar que la cédula no esté en uso por otro usuario
    const existingUser = await prisma.user.findUnique({ where: { documentId } });
    if (existingUser && existingUser.id !== req.user!.id) {
      return res.status(409).json({
        data: null,
        error: 'Esta cédula ya está registrada por otro usuario.',
        code: 'DOCUMENT_IN_USE',
      });
    }

    // 4. Consultar al proveedor de verificación
    const provider = getProvider();
    if (!provider) {
      return res.status(500).json({
        data: null,
        error: 'El servicio de verificación no está configurado. Contacta al administrador.',
        code: 'PROVIDER_NOT_CONFIGURED',
      });
    }

    const result = await verifyIdentity(documentId);

    if (!result.success) {
      return res.status(400).json({
        data: { result },
        error: `La cédula no pudo ser verificada: ${result.error || 'Cédula inválida o no encontrada'}`,
        code: 'VERIFICATION_FAILED',
      });
    }

    // 5. Actualizar usuario con los datos verificados
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        documentId,
        name: result.nombres.split(' ')[0] || user?.name || result.nombres,
        lastName: result.apellidos || user?.lastName || '',
        identityVerified: true,
        verifiedAt: new Date(),
      },
      select: {
        id: true, name: true, lastName: true, documentId: true,
        identityVerified: true, verifiedAt: true,
      },
    });

    // 6. Notificar al usuario
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        type: 'identity_verified',
        title: '✅ Identidad verificada',
        body: `Tu cédula ${documentId} ha sido verificada exitosamente. ¡Ya puedes operar en la plataforma!`,
        data: { documentId, provedor: result.provedor },
      },
    });

    return res.json({
      data: {
        user: updated,
        verification: {
          nombres: result.nombres,
          apellidos: result.apellidos,
          estado: result.estado,
          provedor: result.provedor,
        },
      },
      error: null,
    });
  } catch (e: any) {
    console.error('[verificar-cedula] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/auth/verificar-whatsapp — Verifica si el número tiene WhatsApp activo
authRouter.post('/verificar-whatsapp', authenticate, async (req: AuthRequest, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ data: null, error: 'Número de teléfono requerido' });
  }

  // Limpiar número: quitar +, espacios, dejar solo dígitos
  const clean = phone.replace(/[^\d]/g, '');
  // Asegurar código de país Ecuador (593)
  const fullNumber = clean.startsWith('593') ? clean : '593' + clean.replace(/^0+/, '');

  if (fullNumber.length < 11 || fullNumber.length > 13) {
    return res.status(400).json({ data: null, error: 'Número de teléfono inválido. Debe ser un número ecuatoriano.' });
  }

  try {
    const provider = getProvider();
    if (!provider?.verificarWhatsApp) {
      return res.status(500).json({ data: null, error: 'El servicio de verificación WhatsApp no está disponible.' });
    }

    const result = await verifyWhatsApp(fullNumber);

    return res.json({
      data: {
        phone: fullNumber,
        exists: result.exists,
        whatsapp: result.whatsapp,
      },
      error: result.error || null,
    });
  } catch (e: any) {
    console.error('[verificar-whatsapp] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/auth/me
authRouter.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, lastName, phone, gender, birthDate, documentType, documentId } = req.body;
  try {
    console.log('[PUT /me] body:', JSON.stringify(req.body));
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name         && { name }),
        ...(lastName     && { lastName }),
        ...(phone        && { phone }),
        ...(gender       && { gender }),
        ...(documentType && { documentType }),
        ...(documentId   && { documentId }),
        ...(birthDate    && { birthDate: new Date(birthDate) }),
      },
      select: {
        id: true, email: true, phone: true, name: true,
        lastName: true, documentType: true, documentId: true,
        gender: true, birthDate: true, updatedAt: true,
      },
    });
    return res.json({ data: user, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});
