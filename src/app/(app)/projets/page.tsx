'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { daysUntil, projectDates } from '@/lib/projects';
import { supabaseBrowser } from '@/lib/supabase/client';
import { dayKey } from '@/lib/time';

export default function Projets() {
  const { me, groupId, projects, now, reload, toast } = useApp();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const today = dayKey(now, me.timezone);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (from && to && to < from) { toast('La fin doit être après le début.'); return; }
    setBusy(true);
    const { data, error } = await supabaseBrowser().from('projects')
      .insert({ group_id: groupId, title: title.trim(), starts_on: from || null, ends_on: to || null })
      .select('id').single();
    setBusy(false);
    if (error || !data) { toast("Le projet n'a pas pu être créé. Réessaie."); return; }
    setTitle(''); setFrom(''); setTo('');
    await reload('projects');
    router.push('/projets/' + data.id);
  }

  return (
    <section className="tab">
      <div className="block">
        <h1>Projets de vacances</h1>
        <p className="small muted" style={{ margin: 0 }}>
          Un projet, des idées de lieux, les semaines où chacun est libre, puis on vote et on part.
        </p>
      </div>

      <div className="list">
        {projects.length ? projects.map(p => {
          const left = p.place ? daysUntil(p.starts_on, today) : null;
          return (
            <Link key={p.id} href={'/projets/' + p.id} className="proj">
              <span className="t">{p.title}</span>
              <span className="small muted">{projectDates(p)}</span>
              {p.place
                ? <span className="pill lv-free">On part à {p.place}{left !== null && left > 0 ? ` · J-${left}` : ''}</span>
                : <span className="pill lv-mid">En discussion</span>}
            </Link>
          );
        }) : (
          <div className="empty">Aucun projet pour l&apos;instant. Crée le premier, par exemple « Vacances d&apos;été 2027 ».</div>
        )}
      </div>

      <form className="card" onSubmit={create}>
        <h3>Nouveau projet</h3>
        <label htmlFor="pr-title">
          Nom du projet
          <input id="pr-title" required maxLength={60} value={title} onChange={e => setTitle(e.target.value)} placeholder="Vacances d'été 2027" />
        </label>
        <div className="grid2">
          <label htmlFor="pr-from">Période : du<input id="pr-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label htmlFor="pr-to">au<input id="pr-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Facultatif : une période large (« l&apos;été »). Vous choisirez la semaine exacte ensemble.</p>
        <button className="btn flame" type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer le projet'}</button>
      </form>
    </section>
  );
}
