'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { MapGlobe, type MapPerson } from '@/components/MapGlobe';
import { supabaseBrowser } from '@/lib/supabase/client';
import { distanceKm, fmtKm, geocodeCity } from '@/lib/geo';
import { fmtAgo, fmtTime, tzOffset } from '@/lib/time';
import { LiveLocationToggle } from '@/components/LiveLocation';
import type { Member } from '@/lib/people';

/** « 📍 en direct · il y a 5 min » ou « 🏙️ Toulouse » : d'où vient la position affichée. */
function source(m: Member, now: number) {
  if (m.location_live) return `📍 en direct${m.location_at ? ' · ' + fmtAgo(Date.parse(m.location_at), now) : ''}`;
  return m.city ? `🏙️ ${m.city}` : '';
}

/** « même heure », « +6 h », « −1 h 30 » : décalage de `b` par rapport à `a`. */
function shift(a: string, b: string, now: number) {
  const min = Math.round((tzOffset(now, b) - tzOffset(now, a)) / 60_000);
  if (!min) return 'même heure';
  const h = Math.floor(Math.abs(min) / 60), m = Math.abs(min) % 60;
  return `${min > 0 ? '+' : '−'}${h} h${m ? ` ${m}` : ''}`;
}

/**
 * « Où est tout le monde ? » : position en direct, carte 3D zoomable, distances et heure chez chacun.
 * Utilisée en bas de l'accueil et sur la page /globe. La carte ne se charge qu'à l'approche (`lazy`).
 */
export function GlobeSection({ lazy = false }: { lazy?: boolean }) {
  const { me, members, avatars, now, toast } = useApp();
  const zone = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!lazy);
  useEffect(() => {
    if (near || !zone.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: '600px' });
    io.observe(zone.current);
    return () => io.disconnect();
  }, [near]);
  const router = useRouter();
  const placed: MapPerson[] = members.filter(m => m.lat != null && m.lon != null)
    .map(m => ({ id: m.id, first_name: m.first_name, color: m.color, lat: Number(m.lat), lon: Number(m.lon), avatar: avatars[m.id] }));
  const missing = members.filter(m => m.lat == null || m.lon == null);
  const [chosen, setChosen] = useState<string | null>(null);
  const originId = chosen ?? (placed.some(p => p.id === me.id) ? me.id : placed[0]?.id);
  const origin = placed.find(p => p.id === originId);
  const originMember = members.find(m => m.id === originId);

  // Ma ville n'est pas encore placée (profil créé avant le globe) : on la place une fois, tout seul.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || me.lat != null || me.location_live || !me.city) return;
    tried.current = true;
    geocodeCity(me.city).then(async place => {
      if (!place) return;
      const { error } = await supabaseBrowser().from('profiles').update({ lat: place.lat, lon: place.lon }).eq('id', me.id);
      if (error) toast("Ta ville n'a pas pu être placée sur le globe.");
      else router.refresh();
    });
  }, [me, router, toast]);

  // Les deux personnes les plus éloignées du groupe.
  const farthest = (() => {
    let best: { a: MapPerson; b: MapPerson; km: number } | null = null;
    for (const a of placed) for (const b of placed) {
      if (a.id >= b.id) continue;
      const km = distanceKm([a.lat, a.lon], [b.lat, b.lon]);
      if (!best || km > best.km) best = { a, b, km };
    }
    return best;
  })();

  return (
    <div className="block globe-section" style={{ gap: 14 }}>
      <div className="block" ref={zone}>
        <h2>🌍 Où est tout le monde ?</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Tourne la Terre, zoome jusqu&apos;aux villes. Distances à vol d&apos;oiseau, depuis la position en direct de ceux qui la partagent, sinon depuis leur ville.
        </p>
      </div>

      <LiveLocationToggle />

      {placed.length ? (near ? <MapGlobe people={placed} originId={originId} meId={me.id} /> : <div className="map-wrap" />) : (
        <div className="empty">
          Personne n&apos;est encore placé sur le globe. Ajoute ta ville dans <Link href="/reglages">ton profil</Link>.
        </div>
      )}

      {placed.length > 1 && (
        <div className="block">
          <h3>Distances depuis</h3>
          <div className="chips" role="group" aria-label="Distances depuis">
            {placed.map(p => (
              <button key={p.id} type="button" className="chip" aria-pressed={p.id === originId} onClick={() => setChosen(p.id)}>
                {p.first_name}{p.id === me.id ? ' (moi)' : ''}
              </button>
            ))}
          </div>
          <div className="list">
            {origin && originMember && placed.filter(p => p.id !== origin.id)
              .map(p => ({ p, m: members.find(x => x.id === p.id)!, km: distanceKm([origin.lat, origin.lon], [p.lat, p.lon]) }))
              .sort((x, y) => x.km - y.km)
              .map(({ p, m, km }) => (
                <div key={p.id} className="item">
                  <Dot p={m} size={32} zoom />
                  <div className="grow">
                    <b>{m.first_name}</b>{source(m, now) && <span className="small muted"> · {source(m, now)}</span>}
                    <div className="small muted">
                      {fmtTime(now, m.timezone)} chez {m.first_name} ({shift(originMember.timezone, m.timezone, now)})
                    </div>
                  </div>
                  <b style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtKm(km)}</b>
                </div>
              ))}
          </div>
          {farthest && (
            <p className="small muted" style={{ margin: 0 }}>
              Les plus éloignés : {farthest.a.first_name} et {farthest.b.first_name}, à {fmtKm(farthest.km)} l&apos;un de l&apos;autre.
            </p>
          )}
        </div>
      )}

      {missing.length > 0 && (
        <p className="notice" style={{ margin: 0 }}>
          Pas encore sur le globe : {missing.map(m => m.first_name).join(', ')}.
          Il suffit d&apos;indiquer sa ville dans son profil (Réglages).
        </p>
      )}
    </div>
  );
}
