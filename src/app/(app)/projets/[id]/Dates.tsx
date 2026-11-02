'use client';

import { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate, projectDates } from '@/lib/projects';
import { mondayOf, weekAvailability, weeksBetween } from '@/lib/trip';
import { dayKey, shiftDay } from '@/lib/time';
import type { ProjectData } from './useProject';

const fmtWeek = (w: string) =>
  `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(w + 'T12:00:00Z'))} → ${fmtDate(shiftDay(w, 6))}`;

export function Dates({ d, reload }: { d: ProjectData; reload: () => void }) {
  const { me, members, now, toast } = useApp();
  const pr = d.project!;
  const today = dayKey(now, me.timezone);
  const [from, setFrom] = useState(pr.starts_on ?? '');
  const [to, setTo] = useState(pr.ends_on ?? '');

  // Semaines proposées : la période du projet (ou les 6 prochains mois), plus toutes celles déjà cochées.
  const range = pr.starts_on && pr.ends_on ? weeksBetween(pr.starts_on, pr.ends_on) : weeksBetween(today, shiftDay(today, 182), 26);
  const ticked = Object.values(d.weeks).flatMap(s => [...s]);
  const weeks = [...new Set([...range, ...ticked])].filter(w => w >= mondayOf(today)).sort();
  const rows = weekAvailability(weeks, d.weeks, members.map(m => m.id));
  const best = rows.filter(r => r.all);

  async function toggle(week: string, on: boolean) {
    const sb = supabaseBrowser();
    const { error } = on
      ? await sb.from('project_weeks').delete().eq('project_id', pr.id).eq('user_id', me.id).eq('week_start', week)
      : await sb.from('project_weeks').insert({ project_id: pr.id, week_start: week });
    if (error) toast("Ça n'a pas marché, réessaie."); else reload();
  }

  async function setDates(start: string | null, end: string | null, ok: string) {
    if (start && end && end < start) { toast('La fin doit être après le début.'); return; }
    const { error } = await supabaseBrowser().from('projects').update({ starts_on: start, ends_on: end }).eq('id', pr.id);
    if (error) toast("Ça n'a pas marché, réessaie.");
    else { toast(ok); setFrom(start ?? ''); setTo(end ?? ''); reload(); }
  }

  return (
    <div className="block" style={{ gap: 16 }}>
      <div className="card">
        <h3>Dates du voyage</h3>
        <b>{projectDates(pr)}</b>
        <div className="grid2">
          <label htmlFor="dt-from">Du<input id="dt-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label htmlFor="dt-to">Au<input id="dt-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
        <button className="btn sm" type="button" onClick={() => setDates(from || null, to || null, 'Dates enregistrées')}>Enregistrer les dates</button>
      </div>

      <div className="block">
        <h3>Qui est libre quand ?</h3>
        <p className="small muted" style={{ margin: 0 }}>Coche les semaines où tu pourrais partir. Celles où tout le monde peut sont encadrées.</p>
        {best.length > 0 && (
          <p className="small" style={{ margin: 0 }}>
            <b>Tout le monde est libre {best.length > 1 ? `${best.length} semaines` : 'une semaine'}</b> : à vous de choisir !
          </p>
        )}
        <div className="list">
          {rows.map(r => {
            const on = d.weeks[me.id]?.has(r.week) ?? false;
            return (
              <div key={r.week} className={`item week${r.all ? ' all' : ''}`}>
                <div style={{ minWidth: 0 }}>
                  <b className="small">{fmtWeek(r.week)}</b>
                  <div className="faces" style={{ marginTop: 4 }}>
                    {r.who.length ? r.who.map(id => <Dot key={id} p={members.find(m => m.id === id)} size={22} />)
                      : <span className="small muted">personne</span>}
                  </div>
                </div>
                {r.all
                  ? <button className="btn flame sm" type="button" onClick={() => setDates(r.week, shiftDay(r.week, 6), 'Semaine choisie 🎉')}>Choisir</button>
                  : <span />}
                <button className="chip" type="button" aria-pressed={on} onClick={() => toggle(r.week, on)}
                  aria-label={`${on ? 'Je ne suis plus libre' : 'Je suis libre'} la semaine du ${fmtWeek(r.week)}`}>
                  {on ? 'Libre ✓' : 'Libre ?'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
