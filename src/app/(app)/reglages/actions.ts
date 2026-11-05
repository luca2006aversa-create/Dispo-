'use server';

import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { addMember, isEmail, NAME_DOMAIN, newInviteCode } from '@/lib/members';

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

export type PasswordStatus = { nameAccount: boolean; hasPassword: boolean };

/** Le compte connecté est-il un compte « prénom + code », et a-t-il choisi un mot de passe ? */
export async function passwordStatus(): Promise<PasswordStatus> {
  const { data } = await (await supabaseServer()).auth.getUser();
  return {
    nameAccount: !!data.user?.email?.endsWith(NAME_DOMAIN),
    hasPassword: !!data.user?.app_metadata?.own_password,
  };
}

/** Choisit (ou change) son mot de passe : il sera ensuite demandé à la connexion par prénom. */
export async function setOwnPassword(password: string): Promise<{ ok: boolean; message: string }> {
  if (password.length < 8) return { ok: false, message: 'Au moins 8 caractères.' };
  if (password.length > 72) return { ok: false, message: '72 caractères au maximum.' };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email?.endsWith(NAME_DOMAIN)) return { ok: false, message: "Ce compte se connecte par e-mail : pas besoin de mot de passe." };

  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
    password, app_metadata: { ...user.app_metadata, own_password: true },
  });
  if (error) return { ok: false, message: /weak|pwned|characters/i.test(error.message) ? 'Mot de passe trop simple : choisis-en un autre.' : "Le mot de passe n'a pas pu être enregistré. Réessaie." };
  // Le changement peut fermer les sessions ouvertes : on reconnecte tout de suite cet appareil.
  await supabase.auth.signInWithPassword({ email: user.email, password });
  return { ok: true, message: 'Mot de passe enregistré. Il te sera demandé à la prochaine connexion.' };
}

/** Retire le mot de passe : retour à la connexion avec le prénom et le code d'accès seulement. */
export async function removeOwnPassword(): Promise<{ ok: boolean; message: string }> {
  const { data } = await (await supabaseServer()).auth.getUser();
  const user = data.user;
  if (!user?.email?.endsWith(NAME_DOMAIN)) return { ok: false, message: 'Rien à retirer.' };
  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, own_password: false },
  });
  return error ? { ok: false, message: 'Échec. Réessaie.' } : { ok: true, message: 'Mot de passe retiré.' };
}
