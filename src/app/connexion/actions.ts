'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import { addMember, isEmail, normalizeInviteCode } from '@/lib/members';

/** Crée le compte d'une personne qui a reçu le code d'invitation du groupe. */
export async function joinWithCode(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
  const clean = email.trim().toLowerCase();
  if (!isEmail(clean)) return { ok: false, message: 'Adresse e-mail invalide.' };

  const { data } = await supabaseAdmin().from('group_invite_codes')
    .select('group_id').eq('code', normalizeInviteCode(code)).maybeSingle();
  if (!data) return { ok: false, message: "Ce code d'invitation ne marche pas. Vérifie-le auprès de Luca." };

  if (!(await addMember(data.group_id, clean))) return { ok: false, message: "La création du compte a échoué. Réessaie." };
  return { ok: true };
}
