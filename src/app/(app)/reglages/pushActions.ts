'use server';

import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

async function uid() {
  const { data } = await (await supabaseServer()).auth.getClaims();
  return data?.claims?.sub as string | undefined;
}

/** Enregistre (ou met à jour) l'abonnement de ce téléphone aux notifications. */
export async function saveSubscription(sub: Sub): Promise<{ ok: boolean }> {
  const user = await uid();
  if (!user || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  const { error } = await supabaseAdmin().from('push_subscriptions')
    .upsert({ user_id: user, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: 'endpoint' });
  return { ok: !error };
}

/** Supprime l'abonnement de ce téléphone. */
export async function removeSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await uid();
  if (!user) return { ok: false };
  const { error } = await supabaseAdmin().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user);
  return { ok: !error };
}
