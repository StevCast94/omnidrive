// ===== services/auditoria.ts =====
// Quién hizo qué sobre usuarios, verificaciones, reservas y dinero.
//
// Existe porque un marketplace con dinero necesita poder responder "¿quién
// aprobó esta recarga?" o "¿quién liberó este depósito?" seis meses después.
// También registra los accesos a trazas de ubicación, que son dato personal
// sensible en Ecuador y República Dominicana.

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * Anota una acción administrativa.
 *
 * Nunca hace fallar la operación que la generó: si la auditoría se cae, el
 * admin no puede quedarse sin poder confirmar un pago. Se registra el fallo en
 * el log y se sigue — pero se registra, no se traga en silencio, que es
 * exactamente cómo este proyecto perdió backups e índices durante meses.
 */
export async function registrarAuditoria(
  req: AuthRequest,
  accion: string,
  entidad: string,
  entidadId: string | null,
  antes?: unknown,
  despues?: unknown
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id ?? null,
        // El email va desnormalizado a propósito: si el actor se borra, el
        // registro tiene que seguir diciendo quién fue.
        actorEmail: req.user?.email ?? null,
        action: accion,
        entityType: entidad,
        entityId: entidadId,
        before: limpiar(antes),
        after: limpiar(despues),
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
      },
    });
  } catch (e) {
    console.error(`[Auditoria] No se pudo registrar "${accion}" sobre ${entidad}/${entidadId}:`, e);
  }
}

/** Campos que nunca deben acabar en el registro de auditoría. */
const PROHIBIDOS = new Set([
  'passwordHash', 'password', 'tokenHash', 'accessToken', 'refreshToken',
  'numeroCuenta', 'JWT_SECRET',
]);

function limpiar(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor !== 'object') return valor as Prisma.InputJsonValue;

  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (PROHIBIDOS.has(k)) {
      salida[k] = '[oculto]';
    } else if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
      salida[k] = limpiar(v);
    } else {
      salida[k] = v instanceof Date ? v.toISOString() : v;
    }
  }
  return salida as Prisma.InputJsonValue;
}

/** Historial de una entidad, para el panel de administración. */
export function historialDe(entidad: string, entidadId: string, limite = 50) {
  return prisma.auditLog.findMany({
    where: { entityType: entidad, entityId: entidadId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limite, 200),
  });
}
