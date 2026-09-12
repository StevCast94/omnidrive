// ===== services/google.ts =====
// Verificacion del ID token de Google, sin librerias: Node sabe construir una
// clave publica directamente desde un JWK desde la v16.
//
// El navegador obtiene el id_token con Google Identity Services y lo manda
// aqui. Se verifica la firma contra las claves publicas de Google, el emisor,
// la audiencia y la caducidad. Nunca se confia en el contenido sin verificar
// la firma: un id_token sin verificar es texto que escribe el cliente.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const EMISORES: [string, string] = ['https://accounts.google.com', 'accounts.google.com'];

interface Jwk { kid: string; n: string; e: string; kty: string; alg?: string; use?: string }

let cache: { claves: Jwk[]; expira: number } | null = null;

async function obtenerClaves(): Promise<Jwk[]> {
  if (cache && cache.expira > Date.now()) return cache.claves;

  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`No se pudieron obtener las claves de Google (${res.status})`);
  const body = (await res.json()) as { keys: Jwk[] };

  // Google indica cuanto dura el cache en Cache-Control; por defecto 1 hora.
  const cc = res.headers.get('cache-control') ?? '';
  const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? 3600);
  cache = { claves: body.keys, expira: Date.now() + maxAge * 1000 };
  return body.keys;
}

export interface PerfilGoogle {
  googleId: string;
  email: string;
  emailVerificado: boolean;
  nombre: string;
  apellido: string;
  avatarUrl: string | null;
}

export async function verificarIdTokenGoogle(
  idToken: string,
  clientId: string
): Promise<PerfilGoogle> {
  const cabecera = jwt.decode(idToken, { complete: true })?.header;
  if (!cabecera?.kid) throw new Error('ID token sin kid');

  const claves = await obtenerClaves();
  const jwk = claves.find(k => k.kid === cabecera.kid);
  if (!jwk) throw new Error('Google no reconoce la clave del token');

  const clavePublica = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });

  const payload = jwt.verify(idToken, clavePublica, {
    algorithms: ['RS256'],
    audience: clientId,
    issuer: EMISORES,
  }) as Record<string, any>;

  if (!payload.email) throw new Error('El token de Google no trae email');

  const completo: string = payload.name ?? '';
  const partes = completo.trim().split(/\s+/);

  return {
    googleId: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    emailVerificado: payload.email_verified === true,
    nombre: payload.given_name ?? partes[0] ?? String(payload.email).split('@')[0],
    apellido: payload.family_name ?? partes.slice(1).join(' ') ?? '',
    avatarUrl: payload.picture ?? null,
  };
}
