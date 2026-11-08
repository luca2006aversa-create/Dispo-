'use server';

import { after } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { preview, pushTo } from '@/lib/push';

/** Envoie un message au groupe, puis prévient les autres membres par notification. */
export async function sendMessage(groupId: string, text: string): Promise<{ ok: boolean }> {
  const body = text.trim().slice(0, 1000);
  if (!body) return { ok: false };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false };

  // L'insertion se fait au nom de la personne : les règles d'accès vérifient qu'elle est bien membre.
  const { error } = await supabase.from('messages').insert({ group_id: groupId, body });
  if (error) return { ok: false };

  after(async () => {
    const admin = supabaseAdmin();
    const [{ data: members }, { data: me }] = await Promise.all([
      admin.from('group_members').select('user_id').eq('group_id', groupId),
      admin.from('profiles').select('first_name').eq('id', uid).maybeSingle(),
    ]);
    const others = (members ?? []).map(m => m.user_id).filter(id => id !== uid);
    await pushTo(others, { title: me?.first_name ?? 'Dispo ?', body: preview(body), url: '/chat', tag: 'chat' });
  });
  return { ok: true };
}
