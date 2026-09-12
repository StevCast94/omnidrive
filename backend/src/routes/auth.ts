import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';
import { verifyIdentity, getProvider } from '../services/verification';
import { asyncHandler } from '../middleware/asyncHandler';
import { authLimiter } from '../middleware/rateLimit';
import { env } from '../config/env';
import { getCountry, validarDocumento } from '../config/country';
import { verificarIdTokenGoogle } from '../services/google';
import { enviarResetPassword } from '../services/mailer';
import {
  hashPassword, verifyPassword, validarPassword,
  firmarAccessToken, emitirRefreshToken, rotarRefreshToken,
  revocarRefreshToken, revocarTodasLasSesiones,
  crearTokenDeReset, consumirTokenDeReset,
} from '../services/auth';

export const authRouter = Router();
const pais = getCountry(env.COUNTRY_CODE);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Campos que el usuario puede ver de si mismo.
const CAMPOS_USUARIO = {
  id: true, email: true, phone: true, name: true, lastName: true,
  documentType: true, documentCountry: true, documentId: true,
  birthDate: true, gender: true, avatarUrl: true,
  identityVerified: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true,
  verificationNotes: true, verifiedAt: true, emailVerifiedAt: true,
  walletBalance: true, walletCurrency: true,
  subscriptionTier: true, subscriptionEnds: true,
  countryCode: true, rating: true, totalTrips: true, role: true, createdAt: true,
} as const;

function meta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** Respuesta unica de sesion: el front siempre recibe la misma forma. */
async function responderSesion(
  res: Response,
  req: Request,
  user: { id: string; role: string; email: string; tokenVersion: number },
  status = 200
) {
  const accessToken = firmarAccessToken({
    sub: user.id, role: user.role, email: user.email, tv: user.tokenVersion,
  });
  const refreshToken = await emitirRefreshToken(user.id, meta(req));
  const perfil = await prisma.user.findUnique({ where: { id: user.id }, select: CAMPOS_USUARIO });

  return res.status(status).json({
    data: { accessToken, refreshToken, user: perfil, country: pais.code },
    error: null,
  });
}

// ── POST /api/auth/register ───────────────────────────────────────────
authRouter.post('/register', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, password, name, lastName, documentType, documentId, birthDate } = req.body;

  if (!email || !password || !name || !lastName) {
    return res.status(400).json({ data: null, error: 'Email, contraseña, nombre y apellido son obligatorios' });
  }

  const errorPass = validarPassword(password);
  if (errorPass) return res.status(400).json({ data: null, error: errorPass });

  const correo = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return res.status(400).json({ data: null, error: 'El email no tiene un formato válido' });
  }

  const tipoDoc = documentType ?? pais.documentTypes[0];
  if (documentId && !validarDocumento(pais.code, tipoDoc, documentId)) {
    return res.status(400).json({
      data: null,
      error: tipoDoc === 'passport'
        ? 'El número de pasaporte no tiene un formato válido'
        : `El número de ${tipoDoc} no es válido para ${pais.name}`,
    });
  }

  if (documentId) {
    const vetado = await prisma.bannedIdentity.findFirst({ where: { documentId, active: true } });
    if (vetado) {
      return res.status(403).json({ data: null, error: 'Este documento ha sido vetado en la plataforma.', code: 'BANNED_IDENTITY' });
    }
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: correo }, ...(phone ? [{ phone }] : []), ...(documentId ? [{ documentId }] : [])] },
  });
  if (existing) {
    return res.status(409).json({ data: null, error: 'Ya existe una cuenta con ese email, teléfono o documento' });
  }

  const user = await prisma.user.create({
    data: {
      email: correo,
      phone: phone || null,
      passwordHash: await hashPassword(password),
      name, lastName,
      documentType: tipoDoc,
      documentCountry: pais.code,
      documentId: documentId || null,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      countryCode: pais.code,
      walletCurrency: pais.currency,
    },
    select: { id: true, role: true, email: true, tokenVersion: true },
  });

  return responderSesion(res, req, user, 201);
}));

// ── POST /api/auth/login ──────────────────────────────────────────────
authRouter.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ data: null, error: 'Email y contraseña son obligatorios' });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
    select: { id: true, role: true, email: true, tokenVersion: true, passwordHash: true },
  });

  // Mismo mensaje y mismo trabajo tanto si el email no existe como si la
  // contraseña falla: si no, el login delata quién está registrado.
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) {
    return res.status(401).json({ data: null, error: 'Email o contraseña incorrectos' });
  }

  return responderSesion(res, req, user);
}));

// ── POST /api/auth/google ─────────────────────────────────────────────
authRouter.post('/google', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ data: null, error: 'El login con Google no está configurado en este país' });
  }
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ data: null, error: 'Falta el idToken de Google' });

  let perfil;
  try {
    perfil = await verificarIdTokenGoogle(idToken, env.GOOGLE_CLIENT_ID);
  } catch (e: any) {
    return res.status(401).json({ data: null, error: `Token de Google inválido: ${e.message}` });
  }
  if (!perfil.emailVerificado) {
    return res.status(401).json({ data: null, error: 'Google no confirma ese correo' });
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: perfil.googleId }, { email: perfil.email }] },
    select: { id: true, role: true, email: true, tokenVersion: true, googleId: true },
  });

  if (user && !user.googleId) {
    // Cuenta creada con contraseña que ahora entra con Google: se enlaza.
    // Es seguro porque Google ya confirmó que ese correo le pertenece.
    await prisma.user.update({
      where: { id: user.id },
      data: { googleId: perfil.googleId, emailVerifiedAt: new Date() },
    });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: perfil.email,
        googleId: perfil.googleId,
        emailVerifiedAt: new Date(),
        name: perfil.nombre,
        lastName: perfil.apellido,
        avatarUrl: perfil.avatarUrl,
        documentType: pais.documentTypes[0],
        documentCountry: pais.code,
        countryCode: pais.code,
        walletCurrency: pais.currency,
      },
      select: { id: true, role: true, email: true, tokenVersion: true, googleId: true },
    });
  }

  return responderSesion(res, req, user);
}));

// ── POST /api/auth/refresh ────────────────────────────────────────────
authRouter.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ data: null, error: 'Falta el refresh token' });

  const rotado = await rotarRefreshToken(refreshToken, meta(req));
  if (!rotado) return res.status(401).json({ data: null, error: 'Sesión expirada. Inicia sesión de nuevo.' });

  const accessToken = firmarAccessToken({
    sub: rotado.user.id, role: rotado.user.role, email: rotado.user.email, tv: rotado.user.tokenVersion,
  });
  return res.json({ data: { accessToken, refreshToken: rotado.refresh }, error: null });
}));

// ── POST /api/auth/logout ─────────────────────────────────────────────
authRouter.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken, todas } = req.body;
  if (todas && refreshToken) {
    const rotado = await rotarRefreshToken(refreshToken);
    if (rotado) await revocarTodasLasSesiones(rotado.user.id);
  } else if (refreshToken) {
    await revocarRefreshToken(refreshToken);
  }
  return res.json({ data: { ok: true }, error: null });
}));

// ── POST /api/auth/forgot-password ────────────────────────────────────
authRouter.post('/forgot-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ data: null, error: 'Email requerido' });

  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
    select: { id: true, email: true },
  });

  // Siempre la misma respuesta: decir "ese correo no existe" convierte este
  // endpoint en un buscador de cuentas registradas.
  if (user) {
    const token = await crearTokenDeReset(user.id);
    await enviarResetPassword(user.email, token);
  }

  return res.json({
    data: { mensaje: 'Si ese correo tiene cuenta, le enviamos instrucciones para restablecer la contraseña.' },
    error: null,
  });
}));

// ── POST /api/auth/reset-password ─────────────────────────────────────
authRouter.post('/reset-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ data: null, error: 'Token y contraseña son obligatorios' });

  const errorPass = validarPassword(password);
  if (errorPass) return res.status(400).json({ data: null, error: errorPass });

  const userId = await consumirTokenDeReset(token);
  if (!userId) return res.status(400).json({ data: null, error: 'El enlace no es válido o ya caducó' });

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  // Cambiar la contraseña cierra las sesiones abiertas: si alguien había
  // entrado con la contraseña vieja, deja de estar dentro.
  await revocarTodasLasSesiones(userId);

  return res.json({ data: { mensaje: 'Contraseña actualizada. Inicia sesión.' }, error: null });
}));

// ── POST /api/auth/change-password ────────────────────────────────────
authRouter.post('/change-password', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { actual, nueva } = req.body;
  const errorPass = validarPassword(nueva);
  if (errorPass) return res.status(400).json({ data: null, error: errorPass });

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { passwordHash: true },
  });

  // Una cuenta creada con Google todavía no tiene contraseña: puede ponerse
  // una sin conocer la anterior, porque no existe.
  if (user?.passwordHash && !(await verifyPassword(actual ?? '', user.passwordHash))) {
    return res.status(401).json({ data: null, error: 'La contraseña actual no es correcta' });
  }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { passwordHash: await hashPassword(nueva) },
  });
  await revocarTodasLasSesiones(req.user!.id);

  return res.json({ data: { mensaje: 'Contraseña actualizada. Vuelve a iniciar sesión.' }, error: null });
}));

// ── GET /api/auth/me ──────────────────────────────────────────────────
authRouter.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { ...CAMPOS_USUARIO, documents: true },
  });
  if (!user) return res.status(404).json({ data: null, error: 'User not found' });
  return res.json({ data: user, error: null });
}));

// ── PUT /api/auth/me ──────────────────────────────────────────────────
authRouter.put('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, lastName, phone, gender, birthDate, documentType, documentId } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (lastName !== undefined) data.lastName = lastName;
  if (phone !== undefined) data.phone = phone || null;
  if (gender !== undefined) data.gender = gender;
  if (documentType !== undefined) data.documentType = documentType;
  if (documentId !== undefined) data.documentId = documentId || null;
  if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
    select: CAMPOS_USUARIO,
  });
  return res.json({ data: user, error: null });
}));

// ── POST /api/auth/verify-identity ────────────────────────────────────
authRouter.post(
  '/verify-identity',
  authenticate,
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
    { name: 'licencia', maxCount: 1 },
  ]),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]>;
    if (!files?.selfie || !files?.documentFront) {
      return res.status(400).json({ data: null, error: 'La selfie y el frente del documento son obligatorios' });
    }

    const uid = req.user!.id;
    const tipoDoc = req.body.documentType ?? 'cedula';

    // Quien se identifica con pasaporte es, casi siempre, un turista que va a
    // conducir con la licencia de su país. Sin esa licencia no hay nada que
    // revisar: no se le puede entregar un vehículo.
    if (tipoDoc === 'passport' && !files.licencia) {
      return res.status(400).json({
        data: null,
        error: 'Con pasaporte necesitamos también tu licencia de conducir.',
        code: 'LICENCIA_REQUERIDA',
      });
    }

    const [selfieUrl, documentFrontUrl, documentBackUrl, licenciaUrl] = await Promise.all([
      uploadToStorage(`identity/${uid}/selfie`, files.selfie[0]),
      uploadToStorage(`identity/${uid}/doc-front`, files.documentFront[0]),
      // Un pasaporte no tiene reverso: se sube sólo la hoja de datos.
      files.documentBack ? uploadToStorage(`identity/${uid}/doc-back`, files.documentBack[0]) : Promise.resolve(null),
      files.licencia ? uploadToStorage(`identity/${uid}/licencia`, files.licencia[0]) : Promise.resolve(null),
    ]);

    const user = await prisma.user.update({
      where: { id: uid },
      data: {
        selfieUrl,
        documentFrontUrl,
        documentBackUrl,
        documentType: tipoDoc,
        documentCountry: req.body.documentCountry || pais.code,
        verificationNotes: null,
      },
      select: { id: true, selfieUrl: true, documentFrontUrl: true, documentBackUrl: true, identityVerified: true, verificationNotes: true },
    });

    if (licenciaUrl) {
      // La licencia vive en UserDocument con su caducidad: una licencia vencida
      // no sirve aunque la persona esté verificada.
      await prisma.userDocument.create({
        data: {
          userId: uid,
          type: 'license',
          url: licenciaUrl,
          expiresAt: req.body.licenciaVence ? new Date(req.body.licenciaVence) : null,
        },
      });
    }

    return res.json({
      data: { user, message: 'Documentos recibidos. Pendiente de revisión manual.' },
      error: null,
    });
  })
);

// ── POST /api/auth/verificar-cedula ───────────────────────────────────
authRouter.post('/verificar-cedula', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentId, documentType } = req.body;
  if (!documentId) return res.status(400).json({ data: null, error: 'documentId es requerido' });

  const tipo = documentType ?? 'cedula';

  const banned = await prisma.bannedIdentity.findUnique({ where: { documentId, active: true } });
  if (banned) return res.status(403).json({ data: null, error: 'Este documento ha sido vetado en la plataforma.', code: 'BANNED_IDENTITY' });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (user && user.documentId !== documentId && user.identityVerified) {
    return res.status(400).json({ data: null, error: 'Ya tienes una identidad verificada con otro documento.', code: 'ALREADY_VERIFIED' });
  }

  const existingUser = await prisma.user.findUnique({ where: { documentId } });
  if (existingUser && existingUser.id !== req.user!.id) {
    return res.status(409).json({ data: null, error: 'Este documento ya está registrado por otro usuario.', code: 'DOCUMENT_IN_USE' });
  }

  if (!validarDocumento(pais.code, tipo, documentId)) {
    return res.status(400).json({ data: null, error: 'El número de documento no es válido.', code: 'VERIFICATION_FAILED' });
  }

  const provider = getProvider();

  // Sin proveedor del registro civil, lo único que se comprueba es el dígito
  // verificador, que es un algoritmo público: cualquiera genera un número que
  // pasa. Eso NO verifica a nadie, así que queda pendiente de revisión manual
  // en vez de aprobarse solo. Un pasaporte nunca se autoaprueba.
  if (!provider || tipo === 'passport') {
    const motivo = tipo === 'passport'
      ? 'Pasaporte: requiere revisión manual del documento y la selfie.'
      : `Sin proveedor de verificación en ${pais.name}: requiere revisión manual.`;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { documentId, documentType: tipo, documentCountry: pais.code, verificationNotes: motivo },
    });

    return res.status(202).json({
      data: { estado: 'pendiente', mensaje: motivo },
      error: null,
      code: 'PENDING_MANUAL_REVIEW',
    });
  }

  const result = await verifyIdentity(documentId);
  if (!result.success) {
    return res.status(400).json({
      data: { result },
      error: `El documento no pudo ser verificado: ${result.error || 'No encontrado en el registro civil'}`,
      code: 'VERIFICATION_FAILED',
    });
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      documentId,
      documentType: tipo,
      documentCountry: pais.code,
      name: result.nombres.split(' ')[0] || user?.name || result.nombres,
      lastName: result.apellidos || user?.lastName || '',
      identityVerified: true,
      verifiedAt: new Date(),
    },
    select: { id: true, name: true, lastName: true, documentId: true, identityVerified: true, verifiedAt: true },
  });

  await prisma.notification.create({
    data: {
      userId: req.user!.id,
      type: 'identity_verified',
      title: 'Identidad verificada',
      body: `Tu documento ${documentId} ha sido verificado.`,
      data: { documentId, provedor: result.provedor },
    },
  });

  return res.json({ data: { user: updated, verification: result }, error: null });
}));

// ── POST /api/auth/verificar-whatsapp ─────────────────────────────────
authRouter.post('/verificar-whatsapp', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ data: null, error: 'Número de teléfono requerido' });

  const limpio = String(phone).replace(/\D/g, '');
  const prefijo = pais.phonePrefix.replace('+', '');
  const completo = limpio.startsWith(prefijo) ? limpio : prefijo + limpio.replace(/^0+/, '');

  const provider = getProvider();
  if (!provider?.verificarWhatsApp) {
    return res.status(503).json({ data: null, error: `Verificación por WhatsApp no disponible en ${pais.name}.` });
  }

  const result = await provider.verificarWhatsApp(completo);
  return res.json({ data: { phone: completo, exists: result.exists, whatsapp: result.whatsapp }, error: result.error || null });
}));

// ── POST /api/auth/avatar ─────────────────────────────────────────────
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Formato no soportado. Usa: jpg, png, webp, gif'));
  },
});

authRouter.post('/avatar', authenticate, avatarUpload.single('avatar'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ data: null, error: 'No se envió ninguna imagen' });

  const uid = req.user!.id;
  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'omnidrive/avatars',
        public_id: 'avatar-' + uid,
        overwrite: true,
        transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto:best', format: 'webp' }],
      },
      (err: any, res: any) => (err ? reject(err) : resolve(res))
    );
    stream.end(req.file!.buffer);
  });

  const avatarUrl = result.secure_url.replace('/upload/', '/upload/q_auto:best,f_auto,w_400/');
  await prisma.user.update({ where: { id: uid }, data: { avatarUrl } });

  return res.json({ data: { avatarUrl }, error: null });
}));
