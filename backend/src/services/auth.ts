// ===== services/auth.ts =====
// Autenticacion propia, en la misma base de datos del pais.
//
// Antes las identidades vivian en Supabase. El proyecto desaparecio y se las
// llevo: el backup del Postgres no podia recuperarlas porque nunca estuvieron
// ahi. Ahora un backup de la base es un backup completo.

import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

const scrypt = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

// ── Contrasenas ───────────────────────────────────────────────────────

const SCRYPT_KEYLEN = 64;

/** Formato almacenado: scrypt$<salt hex>$<hash hex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;

  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
  const esperado = Buffer.from(hashHex, 'hex');
  // Comparacion en tiempo constante: un `===` filtra informacion por el tiempo
  // que tarda en fallar.
  return hash.length === esperado.length && crypto.timingSafeEqual(hash, esperado);
}

/** Minimos de la contrasena. Se valida en el servidor, no solo en el formulario. */
export function validarPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (password.length > 200) return 'La contraseña es demasiado larga';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir letras y números';
  }
  return null;
}

// ── Tokens ────────────────────────────────────────────────────────────

/**
 * El access token es corto y no se puede revocar: por eso dura poco.
 * `tv` (tokenVersion) permite invalidar de golpe todas las sesiones de un
 * usuario sin esperar a que caduque.
 */
const ACCESS_TTL = '15m';
// La sesion es "permanente" en el dispositivo: el plazo se renueva con cada
// uso, asi que solo caduca tras un año entero sin abrir la app. Se cierra
// antes solo si la persona sale, cambia la contraseña o se revocan todas.
const REFRESH_DIAS = 365;

// Margen para un token recien rotado. Dos pestañas que renuevan a la vez, o
// una respuesta que se pierde en el movil, dejan al cliente con el token
// anterior; sin este margen eso cerraba la sesion sin que nadie saliera.
const GRACIA_ROTACION_MS = 2 * 60 * 1000;

export interface AccessPayload {
  sub: string;   // User.id
  role: string;
  email: string;
  tv: number;    // tokenVersion
}

export function firmarAccessToken(p: AccessPayload): string {
  return jwt.sign(p, env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verificarAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessPayload;
}

/** El refresh token es opaco: en la base solo queda su hash. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function emitirRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<string> {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300),
      ip: meta.ip,
    },
  });
  return token;
}

/**
 * Canjea un refresh token por uno nuevo (rotacion). Devuelve null si no vale.
 *
 * La rotacion importa: si alguien roba un refresh token y lo usa, el legitimo
 * deja de funcionar y el robo se nota.
 */
export async function rotarRefreshToken(
  token: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<{ user: { id: string; role: string; email: string; tokenVersion: number }; refresh: string } | null> {
  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, role: true, email: true, tokenVersion: true } },
    },
  });

  if (!registro || registro.expiresAt < new Date()) return null;

  if (registro.revokedAt) {
    const hace = Date.now() - registro.revokedAt.getTime();
    if (hace > GRACIA_ROTACION_MS) return null;
    // Solo cuenta como rotacion si se emitio un sucesor en ese mismo instante.
    // Un cierre de sesion o "cerrar todas" revoca sin sucesor: ahi no hay margen.
    const sucesor = await prisma.refreshToken.findFirst({
      where: {
        userId: registro.userId,
        id: { not: registro.id },
        createdAt: {
          gte: new Date(registro.revokedAt.getTime() - 5000),
          lte: new Date(registro.revokedAt.getTime() + 5000),
        },
      },
      select: { id: true },
    });
    if (!sucesor) return null;
  }

  const nuevo = crypto.randomBytes(48).toString('base64url');
  await prisma.$transaction([
    // Dentro del margen de gracia el token ya estaba revocado: no se toca,
    // para no mover la marca de tiempo y alargar el margen indefinidamente.
    prisma.refreshToken.updateMany({
      where: { id: registro.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: registro.userId,
        tokenHash: hashToken(nuevo),
        expiresAt: new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000),
        userAgent: meta.userAgent?.slice(0, 300),
        ip: meta.ip,
      },
    }),
  ]);

  return { user: registro.user, refresh: nuevo };
}

export async function revocarRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cierra todas las sesiones del usuario. */
export async function revocarTodasLasSesiones(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);
}

// ── Restablecer contrasena ────────────────────────────────────────────

export async function crearTokenDeReset(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    },
  });
  return token;
}

export async function consumirTokenDeReset(token: string): Promise<string | null> {
  const registro = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!registro || registro.usedAt || registro.expiresAt < new Date()) return null;

  await prisma.passwordResetToken.update({
    where: { id: registro.id },
    data: { usedAt: new Date() },
  });
  return registro.userId;
}
