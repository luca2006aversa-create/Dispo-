'use server';

import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { addMember, findUserIdByEmail, isEmail, joinGroup, NAME_DOMAIN, normalizeInviteCode } from '@/lib/members';
import { COLORS, plain } from '@/lib/people';
import { geocodeCity } from '@/lib/geo';

type Result = { ok: boolean; message?: string; needPassword?: boolean };

/** Groupe correspondant à un code d'invitation, s'il est valide. */
async function groupOfCode(code: string): Promise<string | undefined> {
  const { data } = await supabaseAdmin().from('group_invite_codes')
    .select('group_id').eq('code', normalizeInviteCode(code)).maybeSingle();
  return data?.group_id;
}

/** Crée le compte d'une personne qui a reçu le code d'invitation du groupe (connexion par e-mail). */
export async function joinWithCode(email: string, code: string): Promise<Result> {
  const clean = email.trim().toLowerCase();
  if (!isEmail(clean)) return { ok: false, message: 'Adresse e-mail invalide.' };
  const groupId = await groupOfCode(code);
  if (!groupId) return { ok: false, message: "Ce code d'invitation ne marche pas. Vérifie-le auprès de Luca." };
  if (!(await addMember(groupId, clean))) return { ok: false, message: 'La création du compte a échoué. Réessaie.' };
  return { ok: true };
}

// Connexion simple, sans e-mail : prénom + code d'accès du groupe.
// Chaque prénom correspond à un compte interne (adresse fictive, jamais utilisée pour écrire).
// Sans mot de passe choisi, n'importe qui ayant le code et un prénom du groupe peut entrer sous ce prénom ;
// chacun peut s'en protéger en choisissant un mot de passe dans les réglages.

const isTimeZone = (tz: string) => {
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: tz }); return true; } catch { return false; }
};

/** Ouvre une session (cookies) sans mot de passe, grâce à un lien de connexion à usage unique créé côté serveur. */
async function openSession(email: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) return false;
  const { error: otpError } = await (await supabaseServer()).auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
  return !otpError;
}

/** Connexion (ou première inscription) avec un prénom et le code d'accès du groupe (et le mot de passe, s'il y en a un). */
export async function loginWithName(name: string, code: string, timezone: string, city = '', password = ''): Promise<Result> {
  const firstName = name.trim().replace(/\s+/g, ' ').slice(0, 30);
  const slug = plain(firstName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return { ok: false, message: 'Écris ton prénom.' };

  const groupId = await groupOfCode(code);
  if (!groupId) return { ok: false, message: "Ce code d'accès ne marche pas. Vérifie-le auprès de Luca." };

  const admin = supabaseAdmin();
  const email = `${slug}.${groupId.slice(0, 8)}${NAME_DOMAIN}`;

  // Un prénom déjà pris par un compte avec e-mail (Luca, par exemple) ne peut pas servir ici.
  const { data: rows } = await admin.from('group_members').select('user_id').eq('group_id', groupId);
  const ids = (rows ?? []).map(r => r.user_id);
  const { data: profiles } = ids.length
    ? await admin.from('profiles').select('id, first_name, color').in('id', ids)
    : { data: [] as { id: string; first_name: string; color: string }[] };
  for (const p of profiles ?? []) {
    if (plain(p.first_name) !== plain(firstName)) continue;
    const { data } = await admin.auth.admin.getUserById(p.id);
    if (data.user && !data.user.email?.endsWith(NAME_DOMAIN)) {
      return { ok: false, message: 'Ce prénom est déjà utilisé par un compte e-mail. Ajoute une initiale (ex. « Gaïa A. ») ou connecte-toi par e-mail.' };
    }
  }

  // Compte avec un mot de passe choisi dans les réglages : il faut ce mot de passe en plus du code.
  // Sinon, session ouverte par un lien à usage unique : le mot de passe ne change jamais,
  // donc les autres appareils déjà connectés le restent.
  let userId = await findUserIdByEmail(email);
  if (userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user?.app_metadata?.own_password) {
      if (!password) return { ok: false, needPassword: true, message: 'Tu as choisi un mot de passe : écris-le pour entrer.' };
      const { error } = await (await supabaseServer()).auth.signInWithPassword({ email, password });
      if (error) return { ok: false, needPassword: true, message: 'Mot de passe incorrect.' };
    } else if (!(await openSession(email))) {
      return { ok: false, message: 'La connexion a échoué. Réessaie dans un instant.' };
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) return { ok: false, message: 'La création du compte a échoué. Réessaie.' };
    userId = data.user.id;
    if (!(await openSession(email))) return { ok: false, message: 'La connexion a échoué. Réessaie dans un instant.' };
  }
  if (!(await joinGroup(groupId, userId))) return { ok: false, message: "L'entrée dans le groupe a échoué. Réessaie." };

  // Profil créé d'office (prénom, couleur libre, fuseau du téléphone) : on arrive directement dans l'app.
  // Ville facultative : elle place la personne sur la Terre (seulement si elle n'en a pas encore).
  const cleanCity = city.trim().slice(0, 40);
  const place = cleanCity ? await geocodeCity(cleanCity) : null;
  const where = place ? { city: cleanCity, lat: place.lat, lon: place.lon } : {};
  const { data: existing } = await admin.from('profiles').select('id, city').eq('id', userId).maybeSingle();
  if (existing && !existing.city && place) await admin.from('profiles').update(where).eq('id', userId);
  if (!existing) {
    const used = new Set((profiles ?? []).map(p => p.color));
    const color = COLORS.find(c => !used.has(c.key))?.key ?? 'bleu';
    const { error } = await admin.from('profiles').insert({
      id: userId, first_name: firstName, color, timezone: isTimeZone(timezone) ? timezone : 'Europe/Paris', ...where,
    });
    if (error) return { ok: false, message: 'La création du profil a échoué. Réessaie.' };
  }

  return { ok: true };
}
