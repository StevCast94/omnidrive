// ===== backend/src/services/push.ts =====
import webpush from 'web-push';
import { prisma } from '../lib/prisma';

function requireVapid(): void {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured — push notifications disabled');
    return;
  }
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'admin@omnidrive.ec'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

let vapidInitialized = false;

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Store push subscriptions in a simple JSON column on User
// In production, use a separate PushSubscription model
const subStore = new Map<string, any>(); // userId → subscription

export function storePushSub(userId: string, sub: any) {
  subStore.set(userId, sub);
}

export function removePushSub(userId: string) {
  subStore.delete(userId);
}

export async function sendPush(userId: string, payload: PushPayload): Promise<boolean> {
  if (!vapidInitialized) { requireVapid(); vapidInitialized = true; }
  const sub = subStore.get(userId);
  if (!sub) return false;

  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));

    // Mark notification as pushed
    await prisma.notification.updateMany({
      where: { userId, pushSent: false, title: payload.title },
      data: { pushSent: true },
    });

    return true;
  } catch (e: any) {
    if (e.statusCode === 410) {
      // Subscription expired
      subStore.delete(userId);
    }
    console.error('[Push] Failed for user', userId, e.message);
    return false;
  }
}

// Send to multiple users
export async function sendPushMany(userIds: string[], payload: PushPayload) {
  await Promise.allSettled(userIds.map(id => sendPush(id, payload)));
}

// Called after every booking status change
export async function notifyBookingStatus(
  bookingId: string,
  status: string,
  tenantId: string,
  ownerId: string,
  vehicleName: string
) {
  const notifs: { userId: string; title: string; body: string }[] = [];

  switch (status) {
    case 'confirmed':
      notifs.push({ userId: tenantId, title: '✅ Reserva confirmada', body: `Tu reserva del ${vehicleName} fue confirmada` });
      break;
    case 'active':
      notifs.push({ userId: ownerId, title: '🚀 Viaje iniciado', body: `El arrendatario inició el viaje en tu ${vehicleName}` });
      break;
    case 'completed':
      notifs.push(
        { userId: tenantId, title: '🏁 Viaje completado', body: '¡Deja tu reseña!' },
        { userId: ownerId, title: '💰 Pago liberado', body: `Pago recibido por ${vehicleName}` }
      );
      break;
    case 'cancelled':
      notifs.push(
        { userId: tenantId, title: '❌ Reserva cancelada', body: `La reserva del ${vehicleName} fue cancelada` },
        { userId: ownerId, title: '❌ Reserva cancelada', body: `Una reserva de tu ${vehicleName} fue cancelada` }
      );
      break;
    case 'disputed':
      notifs.push({ userId: ownerId, title: '⚠️ Disputa abierta', body: `Se abrió una disputa en la reserva de ${vehicleName}` });
      break;
    case 'pending':
      notifs.push({ userId: ownerId, title: '🚗 Nueva solicitud', body: `Alguien quiere rentar tu ${vehicleName}` });
      break;
  }

  for (const n of notifs) {
    await sendPush(n.userId, { title: n.title, body: n.body, data: { bookingId } });
  }
}
