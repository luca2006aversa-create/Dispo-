'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { ConfirmButton } from '@/components/ConfirmButton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { daysUntil, projectDates } from '@/lib/projects';
import { dayKey } from '@/lib/time';
import { useProject } from './useProject';
import { Lieux } from './Lieux';
import { Dates } from './Dates';
import { Orga } from './Orga';
import { Sondages } from './Sondages';

const PARTS = [['lieux', 'Lieux'], ['dates', 'Dates'], ['orga', 'Orga'], ['sondages', 'Sondages'], ['album', 'Album']] as const;
type Part = (typeof PARTS)[number][0];

export default function ProjetPage() {
  const { id } = useParams<{ id: string }>();
  const { me, members, now, reload: reloadApp, toast } = useApp();
  const router = useRouter();
  const { data: d, state, reload } = useProject(id);
  const [part, setPart] = useState<Part>('lieux');

  if (state === 'loading') return <section className="tab"><p className="muted">Chargement…</p></section>;
  if (state === 'missing' || !d.project) {
    return (
      <section className="tab">
        <div className="empty">Ce projet n&apos;existe plus. <Link href="/projets">Voir les projets</Link></div>
      </section>
    );
  }
  const pr = d.project;
  const chosen = d.proposals.find(p => p.id === pr.chosen_proposal);
  const left = chosen ? daysUntil(pr.starts_on, dayKey(now, me.timezone)) : null;

  async function remove() {
    const { error } = await supabaseBrowser().from('projects').delete().eq('id', pr.id);
    if (error) { toast("Ça n'a pas marché, réessaie."); return; }
    toast('Projet supprimé');
    await reloadApp('projects');
    router.replace('/projets');
  }

  return (
    <section className="tab">
      <div className="block" style={{ gap: 4 }}>
        <Link href="/projets" className="small">← Tous les projets</Link>
        <h1>{pr.title}</h1>
        <span className="small muted">
          {projectDates(pr)} · lancé par {members.find(m => m.id === pr.created_by)?.first_name ?? 'quelqu’un'}
        </span>
        {chosen && (
          <span className="pill lv-free" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            On part à {chosen.place}{left !== null && left > 0 ? ` · J-${left}` : left === 0 ? ' · c’est aujourd’hui !' : ''}
          </span>
        )}
      </div>

      <div className="seg" role="group" aria-label="Parties du projet">
        {PARTS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={part === k} onClick={() => setPart(k)}>{l}</button>
        ))}
      </div>

      <div>
        {part === 'lieux' && <Lieux d={d} reload={reload} />}
        {part === 'dates' && <Dates d={d} reload={reload} />}
        {part === 'orga' && <Orga d={d} reload={reload} />}
        {part === 'sondages' && <Sondages d={d} reload={reload} />}
        {part === 'album' && (
          <div className="block">
            <p className="small muted" style={{ margin: 0 }}>Les photos du voyage, rangées ici depuis l&apos;onglet Photos.</p>
            <Link href={`/photos?projet=${pr.id}`} className="btn flame" style={{ textAlign: 'center', textDecoration: 'none' }}>
              📷 Ajouter une photo à l&apos;album
            </Link>
            {d.album.length ? (
              <div className="album">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {d.album.map(p => <img key={p.id} src={p.url} loading="lazy"
                  alt={`Photo de ${members.find(m => m.id === p.user_id)?.first_name ?? 'quelqu’un'}${p.caption ? ' : ' + p.caption : ''}`} />)}
              </div>
            ) : <div className="empty">L&apos;album est vide. Pendant le voyage, chaque photo postée peut y être rangée.</div>}
          </div>
        )}
      </div>

      {pr.created_by === me.id && (
        <div style={{ alignSelf: 'flex-start' }}>
          <ConfirmButton label="Supprimer ce projet" onConfirm={remove} />
        </div>
      )}
    </section>
  );
}
