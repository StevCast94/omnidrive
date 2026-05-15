// ===== backend/src/routes/messaging.ts =====
import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const messagingRouter = Router();

// GET /api/messages — Listar conversaciones del usuario autenticado
messagingRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: { userIds: { has: userId } },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true, lastName: true } } },
        },
        vehicle: { select: { id: true, brand: true, model: true, photos: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Agregar info del otro participante
    const enriched = await Promise.all(conversations.map(async (c) => {
      const otherUserId = c.userIds.find(id => id !== userId);
      let otherUser = null;
      if (otherUserId) {
        const u = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, name: true, lastName: true, phone: true },
        });
        otherUser = u;
      }
      return { ...c, otherUser };
    }));

    return res.json({ data: enriched, error: null });
  } catch (e: any) {
    console.error('[messages] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/messages/:id/messages — Mensajes de una conversación
messagingRouter.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    // Verificar que el usuario sea participante
    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv || !conv.userIds.includes(userId)) {
      return res.status(403).json({ data: null, error: 'No eres participante de esta conversación' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, lastName: true } },
      },
    });

    return res.json({ data: messages, error: null });
  } catch (e: any) {
    console.error('[messages detail] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/messages/start — Iniciar conversación sobre un vehículo
messagingRouter.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { vehicleId, bookingId } = req.body;

    if (!vehicleId && !bookingId) {
      return res.status(400).json({ data: null, error: 'Se requiere vehicleId o bookingId' });
    }

    // Obtener el dueño del vehículo
    let ownerId: string;
    let vId: string;

    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { vehicle: true },
      });
      if (!booking) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });
      ownerId = booking.vehicle.ownerId;
      vId = booking.vehicleId;
    } else {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) return res.status(404).json({ data: null, error: 'Vehículo no encontrado' });
      ownerId = vehicle.ownerId;
      vId = vehicle.id;
    }

    if (userId === ownerId) {
      return res.status(400).json({ data: null, error: 'No puedes iniciar conversación contigo mismo' });
    }

    // Buscar si ya existe conversación para este vehículo entre estos dos
    const existing = await prisma.conversation.findFirst({
      where: {
        vehicleId: vId,
        userIds: { hasEvery: [userId, ownerId] },
      },
    });

    if (existing) {
      return res.json({ data: existing, error: null });
    }

    // Crear conversación
    const conversation = await prisma.conversation.create({
      data: {
        vehicleId: vId,
        bookingId: bookingId || null,
        userIds: [userId, ownerId],
        lastMessageAt: new Date(),
      },
    });

    // Mensaje automático de bienvenida
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, lastName: true },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        text: `Hola! Estoy interesad@ en tu vehículo. ¿Está disponible?`,
      },
    });

    return res.json({ data: conversation, error: null });
  } catch (e: any) {
    console.error('[messages start] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/messages/:id/send — Enviar mensaje
messagingRouter.post('/:id/send', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ data: null, error: 'El mensaje no puede estar vacío' });
    }

    // Verificar participación
    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv || !conv.userIds.includes(userId)) {
      return res.status(403).json({ data: null, error: 'No eres participante' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: userId,
        text: text.trim(),
      },
    });

    // Actualizar lastMessageAt
    await prisma.conversation.update({
      where: { id: convId },
      data: { lastMessageAt: new Date() },
    });

    return res.json({ data: message, error: null });
  } catch (e: any) {
    console.error('[messages send] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/messages/:id/read — Marcar como leído
messagingRouter.post('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv || !conv.userIds.includes(userId)) {
      return res.status(403).json({ data: null, error: 'No eres participante' });
    }

    await prisma.message.updateMany({
      where: {
        conversationId: convId,
        senderId: { not: userId },
        read: false,
      },
      data: { read: true },
    });

    return res.json({ data: { success: true }, error: null });
  } catch (e: any) {
    console.error('[messages read] Error:', e.message);
    return res.status(500).json({ data: null, error: e.message });
  }
});
