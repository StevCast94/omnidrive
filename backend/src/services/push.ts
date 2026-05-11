import webpush from 'web-push';

let initialized = false;

function ensureVapid() {
  if (initialized) return;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'stevens@matrix.local'}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  initialized = true;
}

// In-memory push subscription store (use DB table in production)
const subStore = new Map<string, { endpoint: string; keys: { p256dh: string; auth: string } }[]>();

export async function storePushSub(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  const existing = subStore.get(userId) || [];
  const idx = existing.findIndex(s => s.endpoint === sub.endpoint);
  if (idx >= 0) existing[idx] = sub;
  else existing.push(sub);
  subStore.set(userId, existing);
  return sub;
}

export async function removePushSub(userId: string, endpoint: string) {
  const existing = subStore.get(userId) || [];
  subStore.set(userId, existing.filter(s => s.endpoint !== endpoint));
}

export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: Record<string, any>
) {
  ensureVapid();
  try {
    await webpush.sendNotification(subscription as any, JSON.stringify(payload));
    return { sent: true, error: null };
  } catch (err: any) {
    console.error('[Push] Send failed:', err.message);
    return { sent: false, error: err.message };
  }
}
