import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/server';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I, faciles à confondre

/** Nouveau code d'invitation, du type « K7QF-3XMA ». */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Remet un code tapé à la main au bon format (« k7qf 3xma » → « K7QF-3XMA »). */
export function normalizeInviteCode(input: string): string {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Crée le compte (sans mot de passe) s'il n'existe pas encore et l'ajoute au groupe.
 * À n'appeler qu'après avoir vérifié le droit d'ajouter (admin ou code d'invitation valide).
 */
export async function addMember(groupId: string, email: string): Promise<boolean> {
  const created = await supabaseAdmin().auth.admin.createUser({ email, email_confirm: true });
  // Le compte existe peut-être déjà (invité dans un autre groupe) : on le retrouve.
  const userId = created.data.user?.id ?? await findUserIdByEmail(email);
  return !!userId && joinGroup(groupId, userId);
}

/** Identifiant du compte qui a cette adresse e-mail, s'il existe. */
export async function findUserIdByEmail(email: string): Promise<string | undefined> {
  const admin = supabaseAdmin();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data?.users.find(u => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (!data || data.users.length < 200) return undefined;
  }
}

/** Ajoute la personne au groupe (sans effet si elle y est déjà). */
export async function joinGroup(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from('group_members').upsert(
    { group_id: groupId, user_id: userId, role: 'member' },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true },
  );
  return !error;
}
