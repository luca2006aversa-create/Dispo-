'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export type Proposal = {
  id: string; user_id: string; place: string; lat: number | null; lon: number | null;
  info: string; link: string; created: number;
  photos: { id: string; path: string; url: string; user_id: string }[];
  votes: string[];
  comments: { id: string; user_id: string; body: string; created: number }[];
};
export type Project = {
  id: string; title: string; starts_on: string | null; ends_on: string | null;
  chosen_proposal: string | null; created_by: string;
};
export type ProjectData = {
  project: Project | null;
  proposals: Proposal[];
  /** Semaines libres de chacun (lundis). */
  weeks: Record<string, Set<string>>;
  items: { id: string; label: string; assignee: string | null; done: boolean }[];
  expenses: { id: string; paid_by: string; label: string; cents: number; shared: boolean }[];
  polls: { id: string; question: string; options: string[]; created_by: string; votes: Record<string, number> }[];
  album: { id: string; url: string; user_id: string; caption: string }[];
};

const EMPTY: ProjectData = { project: null, proposals: [], weeks: {}, items: [], expenses: [], polls: [], album: [] };
const TABLES = ['projects', 'proposals', 'proposal_photos', 'proposal_votes', 'proposal_comments',
  'project_weeks', 'project_items', 'project_expenses', 'polls', 'poll_votes', 'photos'];

/** Tout un projet, tenu à jour en temps réel. `state` : chargement, introuvable ou prêt. */
export function useProject(id: string) {
  const [data, setData] = useState<ProjectData>(EMPTY);
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [pr, props, weeks, items, expenses, polls, album] = await Promise.all([
      sb.from('projects').select('id, title, starts_on, ends_on, chosen_proposal, created_by').eq('id', id).maybeSingle(),
      sb.from('proposals').select('id, user_id, place, lat, lon, info, link, created_at, proposal_photos(id, path, user_id), proposal_votes(user_id), proposal_comments(id, user_id, body, created_at)')
        .eq('project_id', id).order('created_at'),
      sb.from('project_weeks').select('user_id, week_start').eq('project_id', id),
      sb.from('project_items').select('id, label, assignee, done').eq('project_id', id).order('created_at'),
      sb.from('project_expenses').select('id, paid_by, label, amount_cents, shared').eq('project_id', id).order('created_at'),
      sb.from('polls').select('id, question, options, created_by, poll_votes(user_id, choice)').eq('project_id', id).order('created_at', { ascending: false }),
      sb.from('photos').select('id, path, user_id, caption').eq('project_id', id).order('created_at', { ascending: false }),
    ]);
    if (!pr.data) { setState('missing'); return; }

    // Une seule demande d'adresses temporaires pour toutes les photos.
    const paths = [
      ...(props.data ?? []).flatMap(p => (p.proposal_photos ?? []).map((x: { path: string }) => x.path)),
      ...(album.data ?? []).map(p => p.path),
    ];
    const { data: signed } = paths.length
      ? await sb.storage.from('photos').createSignedUrls(paths, 60 * 60 * 6)
      : { data: [] as { path: string | null; signedUrl: string }[] };
    const url = new Map((signed ?? []).map(s => [s.path, s.signedUrl]));

    const free: Record<string, Set<string>> = {};
    for (const w of weeks.data ?? []) (free[w.user_id] ??= new Set()).add(w.week_start);

    setData({
      project: pr.data,
      proposals: (props.data ?? []).map(p => ({
        id: p.id, user_id: p.user_id, place: p.place, info: p.info, link: p.link, created: Date.parse(p.created_at),
        lat: p.lat === null ? null : Number(p.lat), lon: p.lon === null ? null : Number(p.lon),
        photos: (p.proposal_photos ?? []).map((x: { id: string; path: string; user_id: string }) => ({ ...x, url: url.get(x.path) ?? '' })),
        votes: (p.proposal_votes ?? []).map((v: { user_id: string }) => v.user_id),
        comments: (p.proposal_comments ?? [])
          .map((c: { id: string; user_id: string; body: string; created_at: string }) => ({ id: c.id, user_id: c.user_id, body: c.body, created: Date.parse(c.created_at) }))
          .sort((a: { created: number }, b: { created: number }) => a.created - b.created),
      })),
      weeks: free,
      items: items.data ?? [],
      expenses: (expenses.data ?? []).map(e => ({ id: e.id, paid_by: e.paid_by, label: e.label, cents: e.amount_cents, shared: e.shared })),
      polls: (polls.data ?? []).map(p => ({
        id: p.id, question: p.question, options: p.options, created_by: p.created_by,
        votes: Object.fromEntries((p.poll_votes ?? []).map((v: { user_id: string; choice: number }) => [v.user_id, v.choice])),
      })),
      album: (album.data ?? []).map(p => ({ id: p.id, user_id: p.user_id, caption: p.caption, url: url.get(p.path) ?? '' })),
    });
    setState('ready');
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const sb = supabaseBrowser();
    // Plusieurs changements arrivent souvent ensemble : on recharge une fois, juste après.
    const later = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 250); };
    let channel = sb.channel('projet-' + id);
    for (const table of TABLES) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, later);
    channel.subscribe();
    return () => { clearTimeout(timer.current); sb.removeChannel(channel); };
  }, [id, load]);

  return { data, state, reload: load };
}
