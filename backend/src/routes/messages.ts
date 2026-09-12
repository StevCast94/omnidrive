// ===== routes/messages.ts =====
// Mensajería entre anfitrión e inquilino.
//
// Los modelos Conversation y Message llevaban meses en el esquema sin una sola
// ruta ni pantalla, así que la conversación real ocurría por WhatsApp. Eso
// tiene dos costes: en una disputa no hay nada que mirar, y las dos partes
// acaban con el teléfono del otro y ningún motivo para volver.
//
// Una conversación existe SIEMPRE ligada a una reserva. No hay mensajería
// suelta: sin reserva de por medio, esto sería un chat abierto a desconocidos.

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendPush } from '../services/push';

export const messagesRouter = Router();

const LARGO_MAXIMO = 2000;

async function conversacionDeReserva(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, tenantId: true, status: true,
      vehicle: { select: { ownerId: true, brand: true, model: true } },
      conversations: { take: 1, select: { id: true, userIds: true } },
    },
  });
  if (!booking) return { error: 'Reserva no encontrada', status: 404 as const };

  const esInquilino = booking.tenantId === userId;
  const esDueno = booking.vehicle.ownerId === userId;
  if (!esInquilino && !esDueno) return { error: 'No participas en esta reserva', status: 403 as const };

  let conversacion = booking.conversations[0];
  if (!conversacion) {
    conversacion = await prisma.conversation.create({
      data: {
        bookingId: booking.id,
        userIds: [booking.tenantId, booking.vehicle.ownerId],
      },
      select: { id: true, userIds: true },
    });
  }

  return { booking, conversacion, esInquilino, esDueno };
}

// ── GET /api/messages — todas mis conversaciones ──────────────────────
messagesRouter.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const yo = req.user!.id;

  const conversaciones = await prisma.conversation.findMany({
    where: { userIds: { has: yo } },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true, bookingId: true, lastMessageAt: true,
      booking: {
        select: {
          id: true, status: true, startAt: true, endAt: true,
          tenantId: true,
          tenant: { select: { id: true, name: true, lastName: true, avatarUrl: true } },
          vehicle: {
            select: {
              brand: true, model: true, photos: true, ownerId: true,
              owner: { select: { id: true, name: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, senderId: true, createdAt: true } },
      _count: { select: { messages: { where: { read: false, NOT: { senderId: yo } } } } },
    },
  });

  return res.json({
    data: conversaciones.map(c => {
      // "El otro" depende de quién pregunta: el mismo hilo es el anfitrión
      // para uno y el inquilino para el otro.
      const soyElInquilino = c.booking?.tenantId === yo;
      const otro = soyElInquilino ? c.booking?.vehicle.owner : c.booking?.tenant;

      return {
        id: c.id,
        bookingId: c.bookingId,
        vehiculo: c.booking ? `${c.booking.vehicle.brand} ${c.booking.vehicle.model}` : null,
        foto: c.booking?.vehicle.photos?.[0] ?? null,
        estadoReserva: c.booking?.status ?? null,
        otro: otro ? { id: otro.id, nombre: `${otro.name} ${otro.lastName}`.trim(), avatarUrl: otro.avatarUrl } : null,
        ultimo: c.messages[0] ?? null,
        sinLeer: c._count.messages,
        lastMessageAt: c.lastMessageAt,
      };
    }),
    error: null,
  });
}));

// ── GET /api/messages/:bookingId — el hilo de una reserva ─────────────
messagesRouter.get('/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await conversacionDeReserva(req.params.bookingId as string, req.user!.id);
  if ('error' in r) return res.status(r.status!).json({ data: null, error: r.error });

  const mensajes = await prisma.message.findMany({
    where: { conversationId: r.conversacion.id },
    orderBy: { createdAt: 'asc' },
    take: 300,
    select: {
      id: true, text: true, senderId: true, read: true, createdAt: true,
      sender: { select: { name: true, lastName: true, avatarUrl: true } },
    },
  });

  // Al abrir el hilo se marcan como leídos los del otro. No los propios: un
  // mensaje propio nunca está "sin leer".
  await prisma.message.updateMany({
    where: { conversationId: r.conversacion.id, read: false, NOT: { senderId: req.user!.id } },
    data: { read: true },
  });

  return res.json({
    data: {
      conversacionId: r.conversacion.id,
      bookingId: r.booking.id,
      estadoReserva: r.booking.status,
      vehiculo: `${r.booking.vehicle.brand} ${r.booking.vehicle.model}`,
      mensajes,
    },
    error: null,
  });
}));

// ── POST /api/messages/:bookingId ─────────────────────────────────────
messagesRouter.post('/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const texto = String(req.body.texto ?? '').trim();
  if (!texto) return res.status(400).json({ data: null, error: 'El mensaje está vacío' });
  if (texto.length > LARGO_MAXIMO) {
    return res.status(400).json({ data: null, error: `El mensaje no puede pasar de ${LARGO_MAXIMO} caracteres` });
  }

  const r = await conversacionDeReserva(req.params.bookingId as string, req.user!.id);
  if ('error' in r) return res.status(r.status!).json({ data: null, error: r.error });

  // Una reserva cancelada o terminada hace tiempo no debería seguir abierta
  // como canal de chat; hasta completada sí, para cerrar detalles.
  if (r.booking.status === 'cancelled') {
    return res.status(409).json({ data: null, error: 'Esta reserva fue cancelada' });
  }

  const [mensaje] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: r.conversacion.id, senderId: req.user!.id, text: texto },
      select: {
        id: true, text: true, senderId: true, read: true, createdAt: true,
        sender: { select: { name: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.conversation.update({
      where: { id: r.conversacion.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  const destinatario = r.esInquilino ? r.booking.vehicle.ownerId : r.booking.tenantId;
  const deQuien = `${mensaje.sender.name} ${mensaje.sender.lastName}`.trim();

  await prisma.notification.create({
    data: {
      userId: destinatario,
      type: 'mensaje',
      title: `Mensaje de ${deQuien}`,
      // Un resumen, no el mensaje entero: la notificación puede verse en una
      // pantalla bloqueada.
      body: texto.length > 80 ? `${texto.slice(0, 80)}…` : texto,
      data: { bookingId: r.booking.id },
    },
  });

  sendPush(destinatario, {
    title: `Mensaje de ${deQuien}`,
    body: texto.length > 80 ? `${texto.slice(0, 80)}…` : texto,
    data: { bookingId: r.booking.id },
  }).catch(() => {
    // Que falle el push no invalida el mensaje: ya está guardado.
  });

  return res.status(201).json({ data: mensaje, error: null });
}));

// ── GET /api/messages/sin-leer/total ──────────────────────────────────
messagesRouter.get('/sin-leer/total', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const total = await prisma.message.count({
    where: {
      read: false,
      NOT: { senderId: req.user!.id },
      conversation: { userIds: { has: req.user!.id } },
    },
  });
  return res.json({ data: { total }, error: null });
}));
