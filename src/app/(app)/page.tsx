'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { FlameIcon, SlotCard, statusOf } from '@/components/bits';
import { commonSlots } from '@/lib/slots';
import { flame } from '@/lib/flames';
import { defiOfDay, DEFIS } from '@/lib/defis';
import { colorVar, plain } from '@/lib/people';
import { dayKey, fmtTime } from '@/lib/time';

export default function Accueil() {
  const { me, members, byId, avails, postedDays, customDefis, now } = useApp();
  const router = useRouter();
  const [offset, setOffset] = useState(0);

  const today = dayKey(now, me.timezone);
  const defi = offset === 0 ? defiOfDay(today) : defiOfDay(today, offset, [...DEFIS, ...customDefis]);

  const flames = useMemo(() => {
    const of = (id: string, since?: string) => {
      const m = byId[id];
      return { days: postedDays[id] ?? new Set<string>(), today: dayKey(now, m.timezone), since };
    };
    return {
      group: flame(members.map(m => of(m.id, dayKey(Date.parse(m.joined_at), m.timezone)))),
      each: members.map(m => ({ m, f: flame([of(m.id)]), posted: postedDays[m.id]?.has(dayKey(now, m.timezone)) })),
    };
  }, [members, byId, postedDays, now]);

  const slots = useMemo(() => commonSlots(avails.map(a => ({ userId: a.user_id, start: Math.max(a.start, now), end: a.end }))), [avails, now]);

  return (
    <section className="tab">
      <Birthday isGaia={plain(me.first_name) === 'gaia'} now={now} />

      <div className="block">
        <h3>Les flammes</h3>
        <div className="flames">
          <div className="fl group">
            <div className="n"><FlameIcon />{flames.group.count}</div>
            <div className="who">
              jour{flames.group.count > 1 ? 's' : ''} de flamme du groupe
              <br /><span style={{ fontWeight: 500, opacity: .9 }}>{members.map(m => m.first_name).join(', ')}</span>
            </div>
          </div>
          {flames.each.map(({ m, f, posted }) => (
            <div key={m.id} className={`fl${posted ? '' : ' off'}`}>
              <div className="n" style={{ color: colorVar(m.color) }}><FlameIcon />{f.count}</div>
              <div className="who">{m.first_name}{posted ? '' : ' · à poster'}</div>
            </div>
          ))}
        </div>
        <div className="small muted">
          Une photo par jour garde ta flamme allumée. La flamme du groupe grandit les jours où tout le monde poste.
        </div>
      </div>

      <div className="defi">
        <h3>Défi du jour</h3>
        <div className="txt">{defi}</div>
        <div className="row">
          <button className="btn flame" type="button" onClick={() => router.push('/photos?defi=' + encodeURIComponent(defi))}>
            Je relève le défi
          </button>
          <button className="btn ghost" type="button" onClick={() => setOffset(o => o + 1)}>Un autre</button>
        </div>
      </div>

      <div className="block">
        <h3>En ce moment</h3>
        <div className="list" style={{ gap: 8 }}>
          {members.map(m => {
            const s = statusOf(m, avails, now);
            return (
              <div key={m.id} className="now">
                <Dot p={m} size={34} />
                <div className="what">
                  <b>{s.label}</b>
                  <span className="small muted">{m.first_name}{m.city ? ` à ${m.city}` : ''}{s.sub ? ' · ' + s.sub : ''}</span>
                </div>
                <div className="clock">
                  {fmtTime(now, m.timezone)}
                  <div style={{ marginTop: 4 }}><span className={`pill lv-${s.lv}`}>{s.pill}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="block">
        <h3>Prochain créneau commun</h3>
        {slots.length ? (
          <SlotCard slot={slots[0]} me={me} byId={byId} everyone={members.length > 1 && slots[0].users.length === members.length} />
        ) : (
          <div className="empty">Aucun créneau commun pour l&apos;instant. <Link href="/dispos">Ajoute une dispo</Link>.</div>
        )}
      </div>
    </section>
  );
}

const BDAY_KEY = 'bday-ferme-';

/** Mot d'anniversaire : chaque 28 octobre, et à la première ouverture de Gaïa tant qu'elle ne l'a pas fermé. */
function Birthday({ isGaia, now }: { isGaia: boolean; now: number }) {
  const [show, setShow] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const year = dayKey(now, 'Europe/Paris').slice(0, 4);
  const isDay = dayKey(now, 'Europe/Paris').slice(5) === '10-28';

  useEffect(() => {
    let closed = false;
    try { closed = localStorage.getItem(BDAY_KEY + year) === '1'; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow((isDay || isGaia) && !closed);
  }, [isDay, isGaia, year]);

  useEffect(() => {
    const c = canvas.current;
    if (!show || !c) return;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2;
    c.height = r.height * 2;
    const x = c.getContext('2d')!;
    const cols = ['#FFC233', '#FFFFFF', '#14213D', '#FF6B3D'];
    let s = 2166136261;
    for (let i = 0; i < 70; i++) {
      s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0;
      const px = s % c.width;
      s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
      const py = s % c.height;
      x.fillStyle = cols[i % 4];
      x.save();
      x.translate(px, py);
      x.rotate(((s % 360) * Math.PI) / 180);
      x.fillRect(-6, -3, 12, 6);
      x.restore();
    }
  }, [show]);

  if (!show) return null;
  return (
    <div className="bday">
      <canvas className="confetti" ref={canvas} aria-hidden="true" />
      <button className="x" type="button" aria-label="Fermer le mot d'anniversaire"
        onClick={() => { try { localStorage.setItem(BDAY_KEY + year, '1'); } catch {} setShow(false); }}>×</button>
      <h2>Joyeux anniversaire Gaïa !</h2>
      <p>
        Ton cadeau, c&apos;est ce petit QG rien qu&apos;à nous : on y dit quand on est dispo, on s&apos;envoie des photos
        et on garde la flamme. Bisous de Hanoï. Luca
      </p>
    </div>
  );
}
