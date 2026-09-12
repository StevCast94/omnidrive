// ===== routes/legal.ts =====
// Textos legales del país y registro de su aceptación.

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { env } from '../config/env';
import { getCountry } from '../config/country';
import {
  documentosLegales, versionesVigentes, POLITICA_CANCELACION,
  type TipoDocumentoLegal,
} from '../config/legal';

export const legalRouter = Router();
const pais = getCountry(env.COUNTRY_CODE);

// GET /api/legal — todos los textos del país (público: hay que poder leerlos
// antes de registrarse, no después)
legalRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    data: {
      pais: pais.code,
      ley: pais.dataProtectionLaw,
      documentos: documentosLegales(pais.code),
      politicaCancelacion: POLITICA_CANCELACION,
    },
    error: null,
  });
});

// GET /api/legal/:tipo
legalRouter.get('/:tipo', (req: Request, res: Response) => {
  const doc = documentosLegales(pais.code).find(d => d.tipo === req.params.tipo);
  if (!doc) return res.status(404).json({ data: null, error: 'Documento no encontrado' });
  return res.json({ data: doc, error: null });
});

// GET /api/legal/estado/mio — qué le falta por aceptar a quien pregunta
legalRouter.get('/estado/mio', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const vigentes = versionesVigentes(pais.code);
  const aceptadas = await prisma.legalAcceptance.findMany({
    where: { userId: req.user!.id },
    select: { tipo: true, version: true, createdAt: true },
  });

  const pendientes = (Object.keys(vigentes) as TipoDocumentoLegal[]).filter(
    tipo => !aceptadas.some(a => a.tipo === tipo && a.version === vigentes[tipo])
  );

  return res.json({
    data: { vigentes, aceptadas, pendientes, alDia: pendientes.length === 0 },
    error: null,
  });
}));

// POST /api/legal/aceptar
legalRouter.post('/aceptar', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { tipos, bookingId } = req.body as { tipos?: TipoDocumentoLegal[]; bookingId?: string };
  const vigentes = versionesVigentes(pais.code);

  // Sin lista explícita se aceptan todos los vigentes: es lo que hace el
  // formulario de registro con una sola casilla.
  const aAceptar = (tipos?.length ? tipos : (Object.keys(vigentes) as TipoDocumentoLegal[]))
    .filter(t => t in vigentes);

  if (aAceptar.length === 0) {
    return res.status(400).json({ data: null, error: 'No hay nada que aceptar' });
  }

  // La versión la pone el servidor, nunca el cliente: si no, cualquiera podría
  // "aceptar" una versión que no existe y quedar al día para siempre.
  await prisma.legalAcceptance.createMany({
    data: aAceptar.map(tipo => ({
      userId: req.user!.id,
      tipo,
      version: vigentes[tipo],
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
      bookingId: bookingId ?? null,
    })),
    skipDuplicates: true,
  });

  return res.json({
    data: { aceptados: aAceptar, versiones: vigentes },
    error: null,
  });
}));
