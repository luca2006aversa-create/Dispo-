'use client';

import { Dot } from './Dot';
import type { Member } from '@/lib/people';
import type { Slot } from '@/lib/slots';
import type { Avail } from './AppProvider';
import { fmtDay, fmtTime, nowIn } from '@/lib/time';

export function FlameIcon() {
  return (
    <svg viewBox="0 0 20 22" aria-hidden="true">
      <path fill="currentColor" d="M10 0c1 4 7 6 7 13a7 7 0 0 1-14 0c0-3 1.5-4.5 3-6 0 3 1.4 4.5 3 4.5C9 8 8 4 10 0z" />
    </svg>
  );
}

/** Un créneau commun, dans mon heure, avec l'heure locale des autres fuseaux à côté. */
export function SlotCard({ slot, me, byId, everyone }: {
  slot: Slot; me: Member; byId: Record<string, Member>; everyone: boolean;
}) {
  const people = slot.users.map(id => byId[id]).filter(Boolean);
  const tz = me.timezone;
  const elsewhere: Member[] = [];
  for (const p of people) {
    if (p.id !== me.id && p.timezone !== tz && !elsewhere.some(o => o.timezone === p.timezone)) elsewhere.push(p);
  }
  return (
    <div className={`slot${everyone ? ' all' : ''}`}>
      <div className="faces">{people.map(p => <Dot key={p.id} p={p} size={30} zoom />)}</div>
      <div style={{ minWidth: 0 }}>
        <div className="when">
          {fmtDay(slot.start, tz)}, {fmtTime(slot.start, tz)} – {fmtTime(slot.end, tz)}
        </div>
        <div className="local">
          {everyone && <b>Tout le monde est libre ! </b>}
          {people.map(p => p.first_name).join(' + ')}
          {elsewhere.map(p => ` · ${fmtTime(slot.start, p.timezone)} – ${fmtTime(slot.end, p.timezone)} chez ${p.first_name}`).join('')}
        </div>
      </div>
    </div>
  );
}

export type Status = { label: string; sub: string; lv: 'imp' | 'mid' | 'free' | 'sleep'; pill: string };

/** Ce que fait la personne en ce moment (dispo déclarée, nuit, ou journée). */
export function statusOf(m: Member, avails: Avail[], now: number): Status {
  const d = avails.find(a => a.user_id === m.id && a.start <= now && a.end > now);
  if (d) {
    return { label: 'Dispo !', sub: `jusqu'à ${fmtTime(d.end, m.timezone)}${d.note ? ' · ' + d.note : ''}`, lv: 'free', pill: 'Dispo' };
  }
  const { min } = nowIn(m.timezone, now);
  if (min < 7 * 60 + 30 || min >= 23 * 60) return { label: 'Sûrement en train de dormir', sub: '', lv: 'sleep', pill: 'Zzz' };
  const next = avails.filter(a => a.user_id === m.id && a.start > now).sort((a, b) => a.start - b.start)[0];
  return {
    label: next ? `Dispo ${fmtDay(next.start, m.timezone)} à ${fmtTime(next.start, m.timezone)}` : 'Pas de dispo indiquée',
    sub: '', lv: 'mid', pill: 'Réveillé·e',
  };
}
