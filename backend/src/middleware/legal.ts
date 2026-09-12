// ===== middleware/legal.ts =====
// Exige tener aceptados los textos legales vigentes antes de las acciones que
// crean obligaciones: reservar y publicar un vehiculo.
//
// Se comprueba en el servidor y no solo con una casilla en el formulario,
// porque la casilla la puede saltar cualquiera y lo que vale en una disputa es
// el registro de aceptacion con su version, fecha e IP.

import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';
import { env } from '../config/env';
import { getCountry } from '../config/country';
import { versionesVigentes, type TipoDocumentoLegal } from '../config/legal';

const pais = getCountry(env.COUNTRY_CODE);

export const requireLegalAlDia = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const vigentes = versionesVigentes(pais.code);
  const aceptadas = await prisma.legalAcceptance.findMany({
    where: { userId: req.user!.id },
    select: { tipo: true, version: true },
  });

  const pendientes = (Object.keys(vigentes) as TipoDocumentoLegal[]).filter(
    tipo => !aceptadas.some(a => a.tipo === tipo && a.version === vigentes[tipo])
  );

  if (pendientes.length > 0) {
    return res.status(451).json({
      data: { pendientes, versiones: vigentes },
      error: 'Tienes que aceptar los términos actualizados para continuar.',
      code: 'LEGAL_PENDIENTE',
    });
  }

  next();
};
