import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { supabaseAdmin } from '../lib/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';

export const authRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/auth/register — el frontend NO envía password como texto plano.
// El registro se hace en Supabase Auth via admin API y se crea el perfil local.
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, phone, password, name, lastName, documentType, documentId, birthDate } = req.body;

  if (!email || !phone || !password || !name || !lastName || !documentType || !documentId)
    return res.status(400).json({ data: null, error: 'Missing required fields' });

  try {
    // 1. Check existing
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }, { documentId }] },
    });
    if (existing) return res.status(409).json({ data: null, error: 'User already exists' });

    // 2. Create in Supabase Auth (hash + JWT handled by Supabase)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      phone,
      password,
      email_confirm: true,
      phone_confirm: true,
    });

    if (authError || !authData.user) {
      return res.status(400).json({ data: null, error: authError?.message || 'Auth creation failed' });
    }

    const authId = authData.user.id;

    // 3. Create local profile linked to Supabase Auth ID
    const user = await prisma.user.create({
      data: {
        authId,
        email,
        phone,
        name,
        lastName,
        documentType,
        documentId,
        birthDate: birthDate ? new Date(birthDate) : undefined,
      },
      select: {
        id: true, email: true, phone: true, name: true, lastName: true,
        role: true, identityVerified: true, walletBalance: true,
        subscriptionTier: true, driverScore: true, createdAt: true,
      },
    });

    return res.status(201).json({
      data: {
        user,
        message: 'Registration successful. Login with your credentials.',
      },
      error: null,
    });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/auth/login — DEPRECATED: el login ahora lo hace el frontend
// directo con supabase.auth.signInWithPassword(). Este endpoint es un proxy
// que a cambio verifica y retorna datos del perfil local.
authRouter.post('/login', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ data: null, error: 'Supabase access token required' });

  try {
    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !supabaseUser) return res.status(401).json({ data: null, error: 'Invalid token' });

    const user = await prisma.user.findUnique({
      where: { authId: supabaseUser.id },
      select: {
        id: true, email: true, phone: true, name: true, lastName: true,
        documentType: true, documentId: true, birthDate: true, gender: true,
        identityVerified: true, selfieUrl: true, walletBalance: true,
        subscriptionTier: true, subscriptionEnds: true, driverScore: true,
        totalTrips: true, totalKm: true, role: true, createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ data: null, error: 'Profile not found' });

    return res.json({ data: { user, token }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/auth/verify-identity
authRouter.post(
  '/verify-identity',
  authenticate,
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]>;
    if (!files?.selfie || !files?.documentFront || !files?.documentBack)
      return res.status(400).json({ data: null, error: 'selfie, documentFront and documentBack are required' });

    try {
      const uid = req.user!.id;
      const [selfieUrl, documentFrontUrl, documentBackUrl] = await Promise.all([
        uploadToStorage(`identity/${uid}/selfie`, files.selfie[0]),
        uploadToStorage(`identity/${uid}/doc-front`, files.documentFront[0]),
        uploadToStorage(`identity/${uid}/doc-back`, files.documentBack[0]),
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
        id: true, email: true, phone: true, name: true, lastName: true,
        documentType: true, documentId: true, birthDate: true, gender: true,
        identityVerified: true, selfieUrl: true, walletBalance: true,
        subscriptionTier: true, subscriptionEnds: true, driverScore: true,
        totalTrips: true, totalKm: true, role: true, createdAt: true,
        documents: true,
      },
    });
    if (!user) return res.status(404).json({ data: null, error: 'User not found' });
    return res.json({ data: user, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/auth/me
authRouter.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, lastName, phone, gender, birthDate } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name && { name }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(gender && { gender }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
      },
      select: {
        id: true, email: true, phone: true, name: true, lastName: true,
        gender: true, birthDate: true, updatedAt: true,
      },
    });
    return res.json({ data: user, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});
