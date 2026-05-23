"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePushSub = storePushSub;
exports.removePushSub = removePushSub;
exports.sendPush = sendPush;
exports.sendPushMany = sendPushMany;
exports.notifyBookingStatus = notifyBookingStatus;
// ===== backend/src/services/push.ts =====
const web_push_1 = __importDefault(require("web-push"));
const prisma_1 = require("../lib/prisma");
function requireVapid() {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn('[Push] VAPID keys not configured — push notifications disabled');
        return;
    }
    web_push_1.default.setVapidDetails(`mailto:${process.env.VAPID_EMAIL ?? 'admin@omnidrive.ec'}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
let vapidInitialized = false;
// Store push subscriptions in a simple JSON column on User
// In production, use a separate PushSubscription model
const subStore = new Map(); // userId → subscription
function storePushSub(userId, sub) {
    subStore.set(userId, sub);
}
function removePushSub(userId) {
    subStore.delete(userId);
}
async function sendPush(userId, payload) {
    if (!vapidInitialized) {
        requireVapid();
        vapidInitialized = true;
    }
    const sub = subStore.get(userId);
    if (!sub)
        return false;
    try {
        await web_push_1.default.sendNotification(sub, JSON.stringify(payload));
        // Mark notification as pushed
        await prisma_1.prisma.notification.updateMany({
            where: { userId, pushSent: false, title: payload.title },
            data: { pushSent: true },
        });
        return true;
    }
    catch (e) {
        if (e.statusCode === 410) {
            // Subscription expired
            subStore.delete(userId);
        }
        console.error('[Push] Failed for user', userId, e.message);
        return false;
    }
}
// Send to multiple users
async function sendPushMany(userIds, payload) {
    await Promise.allSettled(userIds.map(id => sendPush(id, payload)));
}
// Called after every booking status change
async function notifyBookingStatus(bookingId, status, tenantId, ownerId, vehicleName) {
    const notifs = [];
    switch (status) {
        case 'confirmed':
            notifs.push({ userId: tenantId, title: '✅ Reserva confirmada', body: `Tu reserva del ${vehicleName} fue confirmada` });
            break;
        case 'active':
            notifs.push({ userId: ownerId, title: '🚀 Viaje iniciado', body: `El arrendatario inició el viaje en tu ${vehicleName}` });
            break;
        case 'completed':
            notifs.push({ userId: tenantId, title: '🏁 Viaje completado', body: '¡Deja tu reseña!' }, { userId: ownerId, title: '💰 Pago liberado', body: `Pago recibido por ${vehicleName}` });
            break;
        case 'cancelled':
            notifs.push({ userId: tenantId, title: '❌ Reserva cancelada', body: `La reserva del ${vehicleName} fue cancelada` }, { userId: ownerId, title: '❌ Reserva cancelada', body: `Una reserva de tu ${vehicleName} fue cancelada` });
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
//# sourceMappingURL=push.js.map