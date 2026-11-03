'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Member } from '@/lib/people';
import { AvatarZoom } from './AvatarZoom';

export type ProjectLite = { id: string; title: string; starts_on: string | null; ends_on: string | null; place: string | null };
export type Message = { id: string; user_id: string; body: string; created: number };
export type Avail = { id: string; user_id: string; start: number; end: number; note: string };
export type Photo = {
  id: string; user_id: string; path: string; url: string; caption: string; challenge: string;
  created: number; reactions: Record<string, string>;
};

type Ctx = {
  me: Member;
  groupId: string;
  members: Member[];
  byId: Record<string, Member>;
  avails: Avail[];
  photos: Photo[];
  /** Jours locaux où chaque personne a posté (pour les flammes). */
  postedDays: Record<string, Set<string>>;
  customDefis: string[];
  /** Projets de vacances du groupe ; `place` = le lieu choisi (« On part là ! »), s'il y en a un. */
  projects: ProjectLite[];
  /** Derniers messages du chat, du plus ancien au plus récent. */
  messages: Message[];
  /** Messages des autres arrivés depuis la dernière visite du chat. */
  chatUnread: number;
  markChatSeen: () => void;
  /** Adresse (temporaire) de la photo de profil de chaque personne qui en a une. */
  avatars: Record<string, string>;
  /** Affiche en grand la photo de profil d'une personne. */
  zoomAvatar: (id: string) => void;
  now: number;
  reload: (what?: 'avails' | 'photos' | 'defis' | 'messages' | 'projects') => Promise<void>;
  toast: (msg: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;
/** Photo de profil d'une personne, ou rien (aussi hors de l'app, sur l'écran de bienvenue). */
export function useAvatar(id?: string) {
  const ctx = useContext(AppCtx);
  return id ? ctx?.avatars[id] : undefined;
}
export const useZoomAvatar = () => useContext(AppCtx)?.zoomAvatar;

const PHOTO_LIMIT = 60;
const MESSAGE_LIMIT = 150;
const CHAT_SEEN = 'chat-vu';

export function AppProvider({ me, groupId, members, children }: {
  me: Member; groupId: string; members: Member[]; children: React.ReactNode;
}) {
  const [avails, setAvails] = useState<Avail[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [postedDays, setPostedDays] = useState<Record<string, Set<string>>>({});
  const [customDefis, setCustomDefis] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  // Date de la dernière visite du chat (lue après l'affichage : elle vit dans le navigateur).
  const [chatSeen, setChatSeen] = useState<number | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const profileTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800);
  }, []);

  const loadAvails = useCallback(async () => {
    const { data } = await supabaseBrowser().from('availabilities')
      .select('id, user_id, starts_at, ends_at, note')
      .eq('group_id', groupId).gt('ends_at', new Date().toISOString()).order('starts_at');
    setAvails((data ?? []).map(a => ({
      id: a.id, user_id: a.user_id, note: a.note,
      start: Date.parse(a.starts_at), end: Date.parse(a.ends_at),
    })));
  }, [groupId]);

  const loadPhotos = useCallback(async () => {
    const sb = supabaseBrowser();
    const [{ data: rows }, { data: days }] = await Promise.all([
      sb.from('photos').select('id, user_id, path, caption, challenge, created_at, photo_reactions(user_id, emoji)')
        .eq('group_id', groupId).order('created_at', { ascending: false }).limit(PHOTO_LIMIT),
      sb.from('photos').select('user_id, local_day').eq('group_id', groupId),
    ]);
    const list = rows ?? [];
    const { data: signed } = list.length
      ? await sb.storage.from('photos').createSignedUrls(list.map(r => r.path), 60 * 60 * 6)
      : { data: [] };
    const urlOf = new Map((signed ?? []).map(s => [s.path, s.signedUrl]));
    setPhotos(list.map(r => ({
      id: r.id, user_id: r.user_id, path: r.path, caption: r.caption, challenge: r.challenge,
      created: Date.parse(r.created_at), url: urlOf.get(r.path) ?? '',
      reactions: Object.fromEntries((r.photo_reactions ?? []).map((x: { user_id: string; emoji: string }) => [x.user_id, x.emoji])),
    })));
    const posted: Record<string, Set<string>> = {};
    for (const d of days ?? []) (posted[d.user_id] ??= new Set()).add(d.local_day);
    setPostedDays(posted);
  }, [groupId]);

  const loadDefis = useCallback(async () => {
    const { data } = await supabaseBrowser().from('challenges').select('text').eq('group_id', groupId).order('created_at');
    setCustomDefis((data ?? []).map(d => d.text));
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabaseBrowser().from('messages').select('id, user_id, body, created_at')
      .eq('group_id', groupId).order('created_at', { ascending: false }).limit(MESSAGE_LIMIT);
    setMessages((data ?? []).reverse().map(m => ({ id: m.id, user_id: m.user_id, body: m.body, created: Date.parse(m.created_at) })));
  }, [groupId]);

  const loadProjects = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.from('projects').select('id, title, starts_on, ends_on, chosen_proposal')
      .eq('group_id', groupId).order('created_at', { ascending: false });
    const chosen = (data ?? []).map(p => p.chosen_proposal).filter(Boolean);
    const { data: places } = chosen.length
      ? await sb.from('proposals').select('id, place').in('id', chosen)
      : { data: [] as { id: string; place: string }[] };
    const placeOf = new Map((places ?? []).map(p => [p.id, p.place]));
    setProjects((data ?? []).map(p => ({
      id: p.id, title: p.title, starts_on: p.starts_on, ends_on: p.ends_on,
      place: p.chosen_proposal ? placeOf.get(p.chosen_proposal) ?? null : null,
    })));
  }, [groupId]);

  const markChatSeen = useCallback(() => {
    const t = Date.now();
    setChatSeen(t);
    try { localStorage.setItem(CHAT_SEEN, String(t)); } catch {}
  }, []);

  const reload = useCallback(async (what?: 'avails' | 'photos' | 'defis' | 'messages' | 'projects') => {
    if (!what || what === 'avails') await loadAvails();
    if (!what || what === 'photos') await loadPhotos();
    if (!what || what === 'defis') await loadDefis();
    if (!what || what === 'messages') await loadMessages();
    if (!what || what === 'projects') await loadProjects();
  }, [loadAvails, loadPhotos, loadDefis, loadMessages, loadProjects]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    try { setChatSeen(Number(localStorage.getItem(CHAT_SEEN)) || 0); } catch { setChatSeen(0); }
    const sb = supabaseBrowser();
    const filter = `group_id=eq.${groupId}`;
    const channel = sb.channel(`groupe-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities', filter }, () => loadAvails())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter }, () => loadPhotos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_reactions' }, () => loadPhotos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter }, () => loadDefis())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter }, () => loadMessages())
      // Un profil a changé (position en direct, photo…) : les membres sont relus côté serveur.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        clearTimeout(profileTimer.current);
        profileTimer.current = setTimeout(() => router.refresh(), 1000);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter }, () => loadProjects())
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    // En revenant sur l'app (téléphone sorti de veille), on remet tout à jour.
    const onVisible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); reload(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sb.removeChannel(channel);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [groupId, reload, loadAvails, loadPhotos, loadDefis, loadMessages, loadProjects, router]);

  useEffect(() => {
    const withPhoto = members.filter(m => m.avatar_path);
    (withPhoto.length
      ? supabaseBrowser().storage.from('photos').createSignedUrls(withPhoto.map(m => m.avatar_path!), 60 * 60 * 6)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }))
      .then(({ data }) => {
        const url = new Map((data ?? []).map(s => [s.path, s.signedUrl]));
        setAvatars(Object.fromEntries(withPhoto.map(m => [m.id, url.get(m.avatar_path!) ?? ''])));
      });
  }, [members]);

  const chatUnread = chatSeen === null ? 0 : messages.filter(m => m.user_id !== me.id && m.created > chatSeen).length;

  const value = useMemo<Ctx>(() => ({
    me, groupId, members, byId: Object.fromEntries(members.map(m => [m.id, m])),
    avails, photos, postedDays, customDefis, projects, messages, chatUnread, markChatSeen,
    avatars, zoomAvatar: setZoomed, now, reload, toast,
  }), [me, groupId, members, avails, photos, postedDays, customDefis, projects, messages, chatUnread, markChatSeen, avatars, now, reload, toast]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {zoomed && avatars[zoomed] && (
        <AvatarZoom url={avatars[zoomed]} person={members.find(m => m.id === zoomed)} onClose={() => setZoomed(null)} />
      )}
    </AppCtx.Provider>
  );
}
