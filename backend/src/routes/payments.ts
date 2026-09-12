// ===== routes/payments.ts =====
// Billetera del usuario: saldo, movimientos, recargas y retiros.
//
// Mientras no haya pasarela contratada, la recarga es por transferencia
// bancaria con confirmación de un admin. El usuario NUNCA puede acreditarse
// saldo a sí mismo: pide la recarga, y el saldo se mueve cuando alguien
// confirma que el dinero entró.

import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { uploadToStorage } from '../lib/storage';
import { aCentavos } from '../services/pricing';
import { getCountry } from '../config/country';
import { env } from '../config/env';
import {
  saldo, movimientos, solicitarRecarga, solicitarRetiro,
  FondosInsuficientes, EstadoDePagoInvalido,
} from '../services/wallet';

export const paymentsRouter = Router();
const pais = getCountry(env.COUNTRY_CODE);

const comprobanteUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Importe mínimo de recarga: por debajo, la comisión bancaria se come el envío
// y da más trabajo confirmarlo del que vale.
const RECARGA_MINIMA = 500; // 5,00 en la moneda del país

// GET /api/payments/saldo
paymentsRouter.get('/saldo', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  return res.json({ data: await saldo(req.user!.id), error: null });
}));

// GET /api/payments/movimientos
paymentsRouter.get('/movimientos', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const limite = Number(req.query.limite ?? 50);
  const movs = await movimientos(req.user!.id, Number.isFinite(limite) ? limite : 50);

  // Cada movimiento se cuenta desde el punto de vista de quien mira: el mismo
  // pago es salida para el inquilino y entrada para el anfitrión.
  const yo = req.user!.id;
  return res.json({
    data: movs.map(m => ({
      id: m.id,
      tipo: m.type,
      estado: m.status,
      monto: m.amount,
      fee: m.fee,
      moneda: m.currency,
      direccion: m.toUserId === yo ? 'entrada' : 'salida',
      descripcion: m.description,
      reservaId: m.bookingId,
      fecha: m.createdAt,
    })),
    error: null,
  });
}));

// GET /api/payments/instrucciones — cómo recargar en este país
paymentsRouter.get('/instrucciones', authenticate, asyncHandler(async (_req: AuthRequest, res: Response) => {
  return res.json({
    data: {
      moneda: pais.currency,
      simbolo: pais.currencySymbol,
      minimo: RECARGA_MINIMA,
      // Los datos bancarios reales se configuran por entorno: no viven en el
      // repositorio.
      banco: env.DATOS_BANCARIOS || null,
      pasarelasPrevistas: pais.paymentProviders,
    },
    error: null,
  });
}));

// POST /api/payments/recargas
paymentsRouter.post(
  '/recargas',
  authenticate,
  comprobanteUpload.single('comprobante'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const centavos = aCentavos(req.body.monto);
    if (centavos === null) {
      return res.status(400).json({ data: null, error: 'El importe no es válido' });
    }
    if (centavos < RECARGA_MINIMA) {
      return res.status(400).json({
        data: null,
        error: `La recarga mínima es ${pais.currencySymbol}${(RECARGA_MINIMA / 100).toFixed(2)}`,
      });
    }

    let comprobanteUrl: string | undefined;
    if (req.file) {
      comprobanteUrl = await uploadToStorage(
        `recargas/${req.user!.id}/${Date.now()}`,
        req.file
      );
    }

    const mov = await solicitarRecarga(req.user!.id, centavos, {
      metodo: req.body.metodo || 'transferencia',
      referencia: req.body.referencia,
      comprobanteUrl,
    });

    return res.status(201).json({
      data: {
        id: mov.id,
        monto: mov.amount,
        estado: mov.status,
        mensaje: 'Recarga registrada. Se acreditará cuando confirmemos la transferencia.',
      },
      error: null,
    });
  })
);

// POST /api/payments/retiros
paymentsRouter.post('/retiros', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const centavos = aCentavos(req.body.monto);
  if (centavos === null) {
    return res.status(400).json({ data: null, error: 'El importe no es válido' });
  }

  const { banco, tipoCuenta, numeroCuenta, titular } = req.body;
  if (!banco || !numeroCuenta || !titular) {
    return res.status(400).json({ data: null, error: 'Banco, número de cuenta y titular son obligatorios' });
  }

  try {
    const mov = await solicitarRetiro(req.user!.id, centavos, {
      banco, tipoCuenta: tipoCuenta ?? null, numeroCuenta, titular,
    });
    return res.status(201).json({
      data: { id: mov.id, monto: mov.amount, estado: mov.status },
      error: null,
    });
  } catch (e) {
    if (e instanceof FondosInsuficientes) {
      return res.status(402).json({
        data: { faltan: e.faltan },
        error: 'No tienes saldo suficiente para ese retiro',
        code: 'FONDOS_INSUFICIENTES',
      });
    }
    if (e instanceof EstadoDePagoInvalido) {
      return res.status(400).json({ data: null, error: e.message });
    }
    throw e;
  }
}));
