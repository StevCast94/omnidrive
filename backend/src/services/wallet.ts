// ===== services/wallet.ts =====
// Billetera y libro mayor. Todo en centavos enteros.
//
// Dos reglas que no se rompen:
//
//  1. Cada movimiento de dinero escribe una fila en Transaction, dentro de la
//     MISMA transaccion de base de datos que mueve el saldo. Si una de las dos
//     falla, no ocurre ninguna: no hay saldos sin explicacion.
//  2. Un saldo nunca queda negativo. No se comprueba leyendo y luego restando
//     —entre la lectura y la resta cabe otra peticion— sino con un UPDATE
//     condicional que solo aplica si hay fondos, y comprobando cuantas filas
//     cambio.
//
// En produccion habia usuarios con saldo -230 justamente por lo segundo.

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Tx = Prisma.TransactionClient | PrismaClient;

export class FondosInsuficientes extends Error {
  constructor(public faltan: number) {
    super('Fondos insuficientes');
    this.name = 'FondosInsuficientes';
  }
}

export class EstadoDePagoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'EstadoDePagoInvalido';
  }
}

interface DatosMovimiento {
  tipo: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'commission' | 'subscription' | 'hold';
  monto: number;
  moneda: string;
  deUsuario?: string | null;
  aUsuario?: string | null;
  reservaId?: string | null;
  descripcion: string;
  estado?: 'pending' | 'completed' | 'failed' | 'reversed';
  referencia?: string | null;
  fee?: number;
  metadata?: Prisma.InputJsonValue;
}

/** Escribe una linea del libro mayor. Siempre dentro de la transaccion del que llama. */
function anotar(tx: Tx, m: DatosMovimiento) {
  return tx.transaction.create({
    data: {
      type: m.tipo,
      amount: m.monto,
      fee: m.fee ?? 0,
      currency: m.moneda,
      fromUserId: m.deUsuario ?? null,
      toUserId: m.aUsuario ?? null,
      bookingId: m.reservaId ?? null,
      description: m.descripcion,
      status: m.estado ?? 'completed',
      referenceId: m.referencia ?? null,
      metadata: m.metadata,
    },
  });
}

/**
 * Descuenta del disponible solo si alcanza. Devuelve false si no habia fondos.
 *
 * `updateMany` con la condicion en el WHERE lo resuelve la base de datos en una
 * sola operacion atomica: dos peticiones simultaneas no pueden gastar el mismo
 * saldo dos veces.
 */
async function descontarSiAlcanza(tx: Tx, userId: string, centavos: number): Promise<boolean> {
  const r = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: centavos } },
    data: { walletBalance: { decrement: centavos } },
  });
  return r.count === 1;
}

// ── Recargas ──────────────────────────────────────────────────────────

/**
 * Acredita saldo. Solo debe llamarse cuando el dinero YA entro de verdad:
 * un webhook firmado de la pasarela, o un admin confirmando la transferencia.
 * Nunca desde una peticion del propio usuario.
 */
export async function acreditar(
  userId: string,
  centavos: number,
  opciones: { descripcion: string; referencia?: string; tipo?: DatosMovimiento['tipo'] }
) {
  if (centavos <= 0) throw new EstadoDePagoInvalido('El importe debe ser mayor que cero');

  return prisma.$transaction(async tx => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: centavos } },
      select: { walletBalance: true, heldBalance: true, walletCurrency: true },
    });

    await anotar(tx, {
      tipo: opciones.tipo ?? 'deposit',
      monto: centavos,
      moneda: user.walletCurrency,
      aUsuario: userId,
      descripcion: opciones.descripcion,
      referencia: opciones.referencia,
    });

    return user;
  });
}

// ── Reservas ──────────────────────────────────────────────────────────

/**
 * Retiene el importe de la reserva mas el deposito de garantia.
 *
 * Se hace al CONFIRMAR, no al finalizar: un anfitrion no deberia entregar su
 * vehiculo sin que el dinero este apartado. Antes se cobraba al final, cuando
 * ya no habia nada que hacer si el inquilino no tenia fondos.
 */
export async function retenerPorReserva(bookingId: string) {
  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, tenantId: true, totalAmount: true, deposit: true,
        currency: true, paymentStatus: true,
      },
    });
    if (!booking) throw new EstadoDePagoInvalido('Reserva no encontrada');
    if (booking.paymentStatus !== 'pending') {
      throw new EstadoDePagoInvalido(`La reserva ya está en estado "${booking.paymentStatus}"`);
    }

    const aRetener = booking.totalAmount + booking.deposit;

    if (!(await descontarSiAlcanza(tx, booking.tenantId, aRetener))) {
      const actual = await tx.user.findUnique({
        where: { id: booking.tenantId },
        select: { walletBalance: true },
      });
      throw new FondosInsuficientes(aRetener - (actual?.walletBalance ?? 0));
    }

    await tx.user.update({
      where: { id: booking.tenantId },
      data: { heldBalance: { increment: aRetener } },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'held' },
    });

    await anotar(tx, {
      tipo: 'hold',
      monto: aRetener,
      moneda: booking.currency,
      deUsuario: booking.tenantId,
      reservaId: bookingId,
      estado: 'pending',
      descripcion: 'Retención por reserva confirmada (alquiler + depósito)',
      metadata: { alquiler: booking.totalAmount, deposito: booking.deposit },
    });

    return { retenido: aRetener };
  });
}

/**
 * Libera la retencion al completar el alquiler: el dueño cobra, la plataforma
 * se queda su comision y el deposito vuelve al inquilino.
 */
export async function liberarPorReserva(bookingId: string) {
  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, tenantId: true, totalAmount: true, deposit: true, serviceFee: true,
        currency: true, paymentStatus: true,
        vehicle: { select: { ownerId: true } },
      },
    });
    if (!booking) throw new EstadoDePagoInvalido('Reserva no encontrada');
    if (booking.paymentStatus !== 'held') {
      throw new EstadoDePagoInvalido('Esta reserva no tiene fondos retenidos');
    }

    const retenido = booking.totalAmount + booking.deposit;
    const paraElDueno = booking.totalAmount - booking.serviceFee;

    // Sale de lo retenido del inquilino y el depósito vuelve a su disponible.
    await tx.user.update({
      where: { id: booking.tenantId },
      data: {
        heldBalance: { decrement: retenido },
        walletBalance: { increment: booking.deposit },
      },
    });

    await tx.user.update({
      where: { id: booking.vehicle.ownerId },
      data: { walletBalance: { increment: paraElDueno } },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'released' },
    });

    await anotar(tx, {
      tipo: 'payment',
      monto: paraElDueno,
      fee: booking.serviceFee,
      moneda: booking.currency,
      deUsuario: booking.tenantId,
      aUsuario: booking.vehicle.ownerId,
      reservaId: bookingId,
      descripcion: 'Pago del alquiler al anfitrión',
    });

    if (booking.deposit > 0) {
      await anotar(tx, {
        tipo: 'refund',
        monto: booking.deposit,
        moneda: booking.currency,
        aUsuario: booking.tenantId,
        reservaId: bookingId,
        descripcion: 'Devolución del depósito de garantía',
      });
    }

    if (booking.serviceFee > 0) {
      await anotar(tx, {
        tipo: 'commission',
        monto: booking.serviceFee,
        moneda: booking.currency,
        deUsuario: booking.tenantId,
        reservaId: bookingId,
        descripcion: 'Comisión de OmniDrive',
      });
    }

    return { alDueno: paraElDueno, depositoDevuelto: booking.deposit };
  });
}

/**
 * Devuelve todo lo retenido al inquilino (cancelación o disputa a su favor).
 *
 * `parcial` permite retener parte del depósito por daños: ese importe va al
 * dueño y el resto vuelve al inquilino.
 */
export async function reembolsarPorReserva(
  bookingId: string,
  opciones: {
    motivo: string;
    /** Parte del depósito que se queda el anfitrión por daños. */
    retenerDelDeposito?: number;
    /** Parte del ALQUILER que se queda el anfitrión como penalización por
     *  cancelación tardía. Sale del alquiler, nunca del depósito. */
    penalizacionAlAnfitrion?: number;
  } = { motivo: 'Cancelación' }
) {
  return prisma.$transaction(async tx => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, tenantId: true, totalAmount: true, deposit: true,
        currency: true, paymentStatus: true,
        vehicle: { select: { ownerId: true } },
      },
    });
    if (!booking) throw new EstadoDePagoInvalido('Reserva no encontrada');
    if (booking.paymentStatus !== 'held') {
      throw new EstadoDePagoInvalido('Esta reserva no tiene fondos retenidos');
    }

    const retenido = booking.totalAmount + booking.deposit;

    // Del depósito, sólo por daños. Del alquiler, sólo por penalización de
    // cancelación. Cada uno tiene su tope: nunca se puede cobrar de más.
    const porDanos = Math.min(Math.max(opciones.retenerDelDeposito ?? 0, 0), booking.deposit);
    const porCancelacion = Math.min(Math.max(opciones.penalizacionAlAnfitrion ?? 0, 0), booking.totalAmount);

    const paraElDueno = porDanos + porCancelacion;
    const paraElInquilino = retenido - paraElDueno;

    await tx.user.update({
      where: { id: booking.tenantId },
      data: {
        heldBalance: { decrement: retenido },
        walletBalance: { increment: paraElInquilino },
      },
    });

    if (paraElDueno > 0) {
      await tx.user.update({
        where: { id: booking.vehicle.ownerId },
        data: { walletBalance: { increment: paraElDueno } },
      });
      await anotar(tx, {
        tipo: 'payment',
        monto: paraElDueno,
        moneda: booking.currency,
        deUsuario: booking.tenantId,
        aUsuario: booking.vehicle.ownerId,
        reservaId: bookingId,
        descripcion: `Retención del depósito: ${opciones.motivo}`,
      });
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'refunded' },
    });

    await anotar(tx, {
      tipo: 'refund',
      monto: paraElInquilino,
      moneda: booking.currency,
      aUsuario: booking.tenantId,
      reservaId: bookingId,
      descripcion: opciones.motivo,
    });

    return { devuelto: paraElInquilino, alDueno: paraElDueno };
  });
}

// ── Retiros ───────────────────────────────────────────────────────────

/**
 * Solicita un retiro. El dinero sale del disponible inmediatamente para que no
 * se pueda gastar dos veces, y queda como movimiento pendiente hasta que un
 * admin confirma la transferencia bancaria.
 */
export async function solicitarRetiro(
  userId: string,
  centavos: number,
  datosBancarios: Prisma.InputJsonValue
) {
  if (centavos <= 0) throw new EstadoDePagoInvalido('El importe debe ser mayor que cero');

  return prisma.$transaction(async tx => {
    if (!(await descontarSiAlcanza(tx, userId, centavos))) {
      const actual = await tx.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
      throw new FondosInsuficientes(centavos - (actual?.walletBalance ?? 0));
    }

    const user = await tx.user.findUnique({ where: { id: userId }, select: { walletCurrency: true } });

    return anotar(tx, {
      tipo: 'withdrawal',
      monto: centavos,
      moneda: user!.walletCurrency,
      deUsuario: userId,
      estado: 'pending',
      descripcion: 'Retiro solicitado',
      metadata: datosBancarios,
    });
  });
}

/** Un retiro que no se pudo pagar devuelve el dinero al disponible. */
export async function revertirRetiro(transactionId: string, motivo: string) {
  return prisma.$transaction(async tx => {
    const mov = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!mov || mov.type !== 'withdrawal') throw new EstadoDePagoInvalido('Retiro no encontrado');
    if (mov.status !== 'pending') throw new EstadoDePagoInvalido('Ese retiro ya fue resuelto');

    await tx.user.update({
      where: { id: mov.fromUserId! },
      data: { walletBalance: { increment: mov.amount } },
    });
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: 'reversed', description: `${mov.description} — revertido: ${motivo}` },
    });
  });
}

// ── Consulta ──────────────────────────────────────────────────────────

export async function saldo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true, heldBalance: true, walletCurrency: true },
  });
  if (!user) throw new EstadoDePagoInvalido('Usuario no encontrado');

  return {
    disponible: user.walletBalance,
    retenido: user.heldBalance,
    total: user.walletBalance + user.heldBalance,
    moneda: user.walletCurrency,
  };
}

export async function movimientos(userId: string, limite = 50) {
  return prisma.transaction.findMany({
    where: { OR: [{ toUserId: userId }, { fromUserId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limite, 200),
  });
}

// ── Recargas pendientes de confirmacion ───────────────────────────────
// Mientras no haya pasarela contratada, el camino real en Ecuador y RD es la
// transferencia bancaria: la persona transfiere, sube el comprobante y un
// admin confirma. El saldo NO se mueve hasta esa confirmacion.

export async function solicitarRecarga(
  userId: string,
  centavos: number,
  datos: { metodo: string; referencia?: string; comprobanteUrl?: string }
) {
  if (centavos <= 0) throw new EstadoDePagoInvalido('El importe debe ser mayor que cero');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletCurrency: true } });
  if (!user) throw new EstadoDePagoInvalido('Usuario no encontrado');

  return anotar(prisma, {
    tipo: 'deposit',
    monto: centavos,
    moneda: user.walletCurrency,
    aUsuario: userId,
    estado: 'pending',
    descripcion: `Recarga por ${datos.metodo} — pendiente de confirmación`,
    referencia: datos.referencia,
    metadata: { metodo: datos.metodo, comprobanteUrl: datos.comprobanteUrl ?? null },
  });
}

/** Un admin confirma que el dinero entro de verdad. Aqui si se mueve el saldo. */
export async function confirmarRecarga(transactionId: string, adminId: string) {
  return prisma.$transaction(async tx => {
    const mov = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!mov || mov.type !== 'deposit') throw new EstadoDePagoInvalido('Recarga no encontrada');
    if (mov.status !== 'pending') throw new EstadoDePagoInvalido('Esa recarga ya fue resuelta');

    await tx.user.update({
      where: { id: mov.toUserId! },
      data: { walletBalance: { increment: mov.amount } },
    });

    return tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'completed',
        description: (mov.description ?? `Recarga de ${mov.amount}`).replace(' — pendiente de confirmación', ' — confirmada'),
        metadata: { ...(mov.metadata as object ?? {}), confirmadaPor: adminId, confirmadaEn: new Date().toISOString() },
      },
    });
  });
}

export async function rechazarRecarga(transactionId: string, adminId: string, motivo: string) {
  const mov = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!mov || mov.type !== 'deposit') throw new EstadoDePagoInvalido('Recarga no encontrada');
  if (mov.status !== 'pending') throw new EstadoDePagoInvalido('Esa recarga ya fue resuelta');

  // No se toca ningun saldo: nunca llego a acreditarse.
  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: 'failed',
      description: `${mov.description} — rechazada: ${motivo}`,
      metadata: { ...(mov.metadata as object ?? {}), rechazadaPor: adminId, rechazadaEn: new Date().toISOString() },
    },
  });
}
