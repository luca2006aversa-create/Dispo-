import 'server-only';
import { sendNotification, setVapidDetails } from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/server';

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let ready = false;
function setup() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!ready) {
    setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@example.com', pub, priv);
    ready = true;
  }
  return true;
}

/** Raccourcit un message pour une notification. */
export function preview(text: string, max = 140) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Envoie une notification à tous les téléphones des personnes données. Les abonnements morts sont supprimés. */
export async function pushTo(userIds: string[], payload: PushPayload) {
  if (!userIds.length || !setup()) return;
  const admin = supabaseAdmin();
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds);
  const dead: string[] = [];
  await Promise.allSettled((subs ?? []).map(async s => {
    try {
      await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(s.id);
    }
  }));
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);
}
