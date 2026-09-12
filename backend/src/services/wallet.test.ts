// Tests de la billetera contra una base de datos REAL.
//
// Se ejecutan solo si hay TEST_DATABASE_URL: mover dinero con una base
// simulada no prueba nada de lo que importa aquí, que es justamente lo que
// hace Postgres bajo concurrencia. En CI la levanta el workflow.

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const URL_PRUEBAS = process.env.TEST_DATABASE_URL;
const correr = URL_PRUEBAS ? describe : describe.skip;

let prisma: PrismaClient;
let wallet: typeof import('./wallet');

correr('billetera', () => {
  let inquilino: string;
  let dueno: string;
  let vehiculoId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    process.env.DIRECT_URL = URL_PRUEBAS;
    prisma = new PrismaClient({ datasources: { db: { url: URL_PRUEBAS } } });
    wallet = await import('./wallet');
  });

  afterAll(async () => { await prisma.$disconnect(); });

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();

    const t = await prisma.user.create({
      data: {
        email: 'inquilino@test.ec', name: 'Inqui', lastName: 'Lino',
        documentType: 'cedula', walletBalance: 50000, identityVerified: true,
      },
    });
    const o = await prisma.user.create({
      data: {
        email: 'dueno@test.ec', name: 'Due', lastName: 'No',
        documentType: 'cedula', identityVerified: true,
      },
    });
    inquilino = t.id;
    dueno = o.id;

    const v = await prisma.vehicle.create({
      data: {
        ownerId: dueno, brand: 'Test', model: 'Uno', year: 2024,
        plate: 'TST-0001', color: 'Rojo', vin: 'VINTEST0000000001',
        category: 'car', seats: 5, transmission: 'automatic', fuelType: 'gasoline',
        pricePerHour: 1000, pricePerDay: 12000, deposit: 30000,
      },
    });
    vehiculoId = v.id;
  });

  async function nuevaReserva(total = 12000, deposito = 30000, comision = 0) {
    const b = await prisma.booking.create({
      data: {
        vehicleId: vehiculoId, tenantId: inquilino,
        startAt: new Date('2026-10-01'), endAt: new Date('2026-10-02'),
        baseAmount: total, serviceFee: comision, totalAmount: total, deposit: deposito,
      },
    });
    return b.id;
  }

  const saldoDe = (id: string) =>
    prisma.user.findUniqueOrThrow({ where: { id }, select: { walletBalance: true, heldBalance: true } });

  it('retener mueve el dinero de disponible a retenido, sin crearlo ni destruirlo', async () => {
    const b = await nuevaReserva();
    await wallet.retenerPorReserva(b);

    const s = await saldoDe(inquilino);
    expect(s.walletBalance).toBe(50000 - 42000);
    expect(s.heldBalance).toBe(42000);
    expect(s.walletBalance + s.heldBalance).toBe(50000);
  });

  it('no se puede retener sin fondos, y el saldo NO queda negativo', async () => {
    await prisma.user.update({ where: { id: inquilino }, data: { walletBalance: 1000 } });
    const b = await nuevaReserva();

    await expect(wallet.retenerPorReserva(b)).rejects.toThrow('Fondos insuficientes');

    const s = await saldoDe(inquilino);
    expect(s.walletBalance).toBe(1000);
    expect(s.heldBalance).toBe(0);
    // Y la reserva no se queda marcada como pagada.
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: b } });
    expect(booking.paymentStatus).toBe('pending');
  });

  it('REGRESIÓN: dos retenciones simultáneas no pueden gastar el mismo saldo', async () => {
    // Saldo justo para UNA. Antes se leía el saldo y luego se restaba, así que
    // dos peticiones a la vez pasaban las dos y dejaban el saldo negativo:
    // en producción había usuarios con -230.
    await prisma.user.update({ where: { id: inquilino }, data: { walletBalance: 42000 } });
    const [b1, b2] = [await nuevaReserva(), await nuevaReserva()];

    const r = await Promise.allSettled([
      wallet.retenerPorReserva(b1),
      wallet.retenerPorReserva(b2),
    ]);

    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.filter(x => x.status === 'rejected')).toHaveLength(1);

    const s = await saldoDe(inquilino);
    expect(s.walletBalance).toBe(0);
    expect(s.heldBalance).toBe(42000);
    expect(s.walletBalance).toBeGreaterThanOrEqual(0);
  });

  it('liberar paga al dueño y devuelve el depósito al inquilino', async () => {
    const b = await nuevaReserva(12000, 30000, 0);
    await wallet.retenerPorReserva(b);
    await wallet.liberarPorReserva(b);

    const t = await saldoDe(inquilino);
    const o = await saldoDe(dueno);

    expect(t.heldBalance).toBe(0);
    expect(t.walletBalance).toBe(50000 - 12000); // pagó el alquiler, recuperó el depósito
    expect(o.walletBalance).toBe(12000);
  });

  it('con comisión, al dueño le llega el total menos la comisión', async () => {
    const b = await nuevaReserva(12000, 0, 1200);
    await wallet.retenerPorReserva(b);
    await wallet.liberarPorReserva(b);

    expect((await saldoDe(dueno)).walletBalance).toBe(12000 - 1200);
    const comision = await prisma.transaction.findFirst({ where: { type: 'commission' } });
    expect(comision?.amount).toBe(1200);
  });

  it('reembolsar devuelve todo y deja la reserva como reembolsada', async () => {
    const b = await nuevaReserva();
    await wallet.retenerPorReserva(b);
    await wallet.reembolsarPorReserva(b, { motivo: 'Cancelada por el dueño' });

    const s = await saldoDe(inquilino);
    expect(s.walletBalance).toBe(50000);
    expect(s.heldBalance).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b } })).paymentStatus).toBe('refunded');
  });

  it('se puede retener parte del depósito por daños', async () => {
    const b = await nuevaReserva(12000, 30000);
    await wallet.retenerPorReserva(b);
    await wallet.reembolsarPorReserva(b, { motivo: 'Rayón en la puerta', retenerDelDeposito: 8000 });

    expect((await saldoDe(inquilino)).walletBalance).toBe(50000 - 8000);
    expect((await saldoDe(dueno)).walletBalance).toBe(8000);
  });

  it('nunca se retiene del depósito más de lo que hay', async () => {
    const b = await nuevaReserva(12000, 30000);
    await wallet.retenerPorReserva(b);
    await wallet.reembolsarPorReserva(b, { motivo: 'Daño grave', retenerDelDeposito: 999999 });

    expect((await saldoDe(dueno)).walletBalance).toBe(30000);
    expect((await saldoDe(inquilino)).walletBalance).toBe(50000 - 30000);
  });

  it('no se libera dos veces la misma reserva', async () => {
    const b = await nuevaReserva();
    await wallet.retenerPorReserva(b);
    await wallet.liberarPorReserva(b);
    await expect(wallet.liberarPorReserva(b)).rejects.toThrow('no tiene fondos retenidos');
  });

  it('una recarga no mueve saldo hasta que un admin la confirma', async () => {
    const mov = await wallet.solicitarRecarga(inquilino, 20000, { metodo: 'transferencia' });
    expect((await saldoDe(inquilino)).walletBalance).toBe(50000);

    await wallet.confirmarRecarga(mov.id, dueno);
    expect((await saldoDe(inquilino)).walletBalance).toBe(70000);
  });

  it('una recarga rechazada no acredita nada, ni siquiera al reintentar', async () => {
    const mov = await wallet.solicitarRecarga(inquilino, 20000, { metodo: 'transferencia' });
    await wallet.rechazarRecarga(mov.id, dueno, 'Comprobante ilegible');

    expect((await saldoDe(inquilino)).walletBalance).toBe(50000);
    await expect(wallet.confirmarRecarga(mov.id, dueno)).rejects.toThrow('ya fue resuelta');
  });

  it('confirmar dos veces la misma recarga no acredita dos veces', async () => {
    const mov = await wallet.solicitarRecarga(inquilino, 20000, { metodo: 'transferencia' });
    await wallet.confirmarRecarga(mov.id, dueno);
    await expect(wallet.confirmarRecarga(mov.id, dueno)).rejects.toThrow('ya fue resuelta');
    expect((await saldoDe(inquilino)).walletBalance).toBe(70000);
  });

  it('el retiro descuenta al solicitarlo, para que no se gaste dos veces', async () => {
    await wallet.solicitarRetiro(inquilino, 30000, { banco: 'Pichincha', cuenta: '****1234' });
    expect((await saldoDe(inquilino)).walletBalance).toBe(20000);
  });

  it('un retiro que no se pudo pagar devuelve el dinero', async () => {
    const mov = await wallet.solicitarRetiro(inquilino, 30000, { banco: 'Pichincha' });
    await wallet.revertirRetiro(mov.id, 'Cuenta bancaria incorrecta');
    expect((await saldoDe(inquilino)).walletBalance).toBe(50000);
  });

  it('cada movimiento de dinero deja su línea en el libro mayor', async () => {
    const b = await nuevaReserva();
    await wallet.retenerPorReserva(b);
    await wallet.liberarPorReserva(b);

    const movs = await prisma.transaction.findMany({ where: { bookingId: b } });
    const tipos = movs.map(m => m.type).sort();
    expect(tipos).toEqual(['hold', 'payment', 'refund']);
    expect(movs.every(m => Number.isInteger(m.amount))).toBe(true);
  });

  it('el saldo total del sistema no cambia al mover dinero entre personas', async () => {
    const totalAntes = 50000;
    const b = await nuevaReserva(12000, 30000);
    await wallet.retenerPorReserva(b);
    await wallet.liberarPorReserva(b);

    const t = await saldoDe(inquilino);
    const o = await saldoDe(dueno);
    expect(t.walletBalance + t.heldBalance + o.walletBalance + o.heldBalance).toBe(totalAntes);
  });
});
