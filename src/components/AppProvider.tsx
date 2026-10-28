'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Member } from '@/lib/people';

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
  now: number;
  reload: (what?: 'avails' | 'photos' | 'defis') => Promise<void>;
  toast: (msg: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const PHOTO_LIMIT = 60;

export function AppProvider({ me, groupId, members, children }: {
  me: Member; groupId: string; members: Member[]; children: React.ReactNode;
}) {
  const [avails, setAvails] = useState<Avail[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [postedDays, setPostedDays] = useState<Record<string, Set<string>>>({});
  const [customDefis, setCustomDefis] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const reload = useCallback(async (what?: 'avails' | 'photos' | 'defis') => {
    if (!what || what === 'avails') await loadAvails();
    if (!what || what === 'photos') await loadPhotos();
    if (!what || what === 'defis') await loadDefis();
  }, [loadAvails, loadPhotos, loadDefis]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const sb = supabaseBrowser();
    const filter = `group_id=eq.${groupId}`;
    const channel = sb.channel(`groupe-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities', filter }, () => loadAvails())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter }, () => loadPhotos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_reactions' }, () => loadPhotos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter }, () => loadDefis())
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
  }, [groupId, reload, loadAvails, loadPhotos, loadDefis]);

  const value = useMemo<Ctx>(() => ({
    me, groupId, members, byId: Object.fromEntries(members.map(m => [m.id, m])),
    avails, photos, postedDays, customDefis, now, reload, toast,
  }), [me, groupId, members, avails, photos, postedDays, customDefis, now, reload, toast]);

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
