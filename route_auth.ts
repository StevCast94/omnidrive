import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';

export const authRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, phone, password, name, lastName, documentType, documentId, birthDate } = req.body;

  if (!email || !phone || !password || !name || !lastName || !documentType || !documentId)
    return res.status(400).json({ data: null, error: 'Missing required fields' });

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }, { documentId }] },
    });
    if (existing) return res.status(409).json({ data: null, error: 'User already exists' });

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, phone, password: hash, name, lastName, documentType, documentId, birthDate: birthDate ? new Date(birthDate) : undefined },
      select: { id: true, email: true, phone: true, name: true, lastName: true, role: true, identityVerified: true, walletBalance: true, subscriptionTier: true, driverScore: true, createdAt: true },
    } as any);

    const token = jwt.sign({ id: (user as any).id }, process.env.JWT_SECRET!, { expiresIn: '30d' });
    return res.status(201).json({ data: { user, token }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, phone, password } = req.body;
  if (!password || (!email && !phone))
    return res.status(400).json({ data: null, error: 'Email/phone and password required' });

  try {
    const user = await prisma.user.findFirst({
      where: email ? { email } : { phone },
    }) as any;
    if (!user) return res.status(401).json({ data: null, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ data: null, error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '30d' });
    const { password: _p, ...safeUser } = user;
    return res.json({ data: { user: safeUser, token }, error: null });
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
