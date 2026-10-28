'use server';

import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { addMember, isEmail, newInviteCode } from '@/lib/members';

export type InviteResult = { ok: boolean; message: string };

async function isAdmin(groupId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('is_group_admin', { gid: groupId });
  return data === true;
}

/** L'admin du groupe invite quelqu'un par son adresse e-mail. */
export async function invite(groupId: string, email: string): Promise<InviteResult> {
  const clean = email.trim().toLowerCase();
  if (!isEmail(clean)) return { ok: false, message: 'Adresse e-mail invalide.' };
  if (!(await isAdmin(groupId))) return { ok: false, message: "Seul l'admin du groupe peut inviter." };
  if (!(await addMember(groupId, clean))) return { ok: false, message: "L'invitation a échoué. Réessaie plus tard." };
  return { ok: true, message: `${clean} est invité·e. Envoie-lui le lien de l'app : elle ou il se connecte avec cette adresse.` };
}

/** Crée ou remplace le code d'invitation du groupe (l'ancien cesse de marcher). */
export async function regenerateInviteCode(groupId: string): Promise<{ code?: string; error?: string }> {
  if (!(await isAdmin(groupId))) return { error: "Seul l'admin du groupe peut changer le code." };
  const code = newInviteCode();
  const { error } = await supabaseAdmin().from('group_invite_codes')
    .upsert({ group_id: groupId, code, updated_at: new Date().toISOString() });
  return error ? { error: "Le code n'a pas pu être créé. Vérifie que la migration des codes a été lancée." } : { code };
}
