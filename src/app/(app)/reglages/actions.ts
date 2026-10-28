'use server';

import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';

export type InviteResult = { ok: boolean; message: string };

/** L'admin du groupe invite quelqu'un : on crée son compte (sans mot de passe) et on l'ajoute au groupe. */
export async function invite(groupId: string, email: string): Promise<InviteResult> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, message: 'Adresse e-mail invalide.' };

  const supabase = await supabaseServer();
  const { data: isAdmin } = await supabase.rpc('is_group_admin', { gid: groupId });
  if (!isAdmin) return { ok: false, message: "Seul l'admin du groupe peut inviter." };

  const admin = supabaseAdmin();
  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({ email: clean, email_confirm: true });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    // Le compte existe peut-être déjà (invité dans un autre groupe) : on le retrouve.
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      userId = data?.users.find(u => u.email?.toLowerCase() === clean)?.id;
      if (!data || data.users.length < 200) break;
    }
  }
  if (!userId) return { ok: false, message: "Impossible de créer ce compte. Réessaie plus tard." };

  const { error } = await admin.from('group_members').upsert(
    { group_id: groupId, user_id: userId, role: 'member' },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, message: "Le compte existe, mais l'ajout au groupe a échoué." };
  return { ok: true, message: `${clean} est invité·e. Envoie-lui le lien de l'app : elle ou il se connecte avec cette adresse.` };
}
