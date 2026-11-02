'use client';

import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { Dot } from './Dot';
import { colorRgb } from '@/lib/people';
import { distanceKm, fmtKm } from '@/lib/geo';

export type GlobePerson = { id: string; first_name: string; color: string; lat: number; lon: number };

/** Angles du globe (cobe) qui mettent un point au centre de l'écran. */
const anglesOf = (lat: number, lon: number): [number, number] =>
  [Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180];

// Identifiant CSS sûr pour les ancres (les uuid peuvent commencer par un chiffre).
const anchor = (id: string) => `p${id.replace(/[^a-zA-Z0-9-]/g, '')}`;

function isDark() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Globe 3D qui tourne au doigt : un point par personne, des arcs depuis `originId` vers les autres,
 * le prénom de chacun et la distance au-dessus de chaque arc.
 */
export function Globe({ people, originId }: { people: GlobePerson[]; originId?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const origin = people.find(p => p.id === originId);
  const others = origin ? people.filter(p => p.id !== origin.id) : [];
  // Valeurs lues à chaque image par le globe, sans le recréer.
  const start: [number, number] = origin ? anglesOf(origin.lat, origin.lon) : [0, 0.3];
  const target = useRef<[number, number]>(start);
  const live = useRef({ phi: start[0], theta: start[1], dragX: null as number | null });
  const globe = useRef<ReturnType<typeof createGlobe> | null>(null);

  const markers = people.map(p => ({
    id: anchor(p.id), location: [p.lat, p.lon] as [number, number],
    size: p.id === originId ? 0.09 : 0.06, color: colorRgb(p.color),
  }));
  const arcs = others.map(p => ({
    id: anchor(p.id), from: [origin!.lat, origin!.lon] as [number, number], to: [p.lat, p.lon] as [number, number],
  }));
  const shape = JSON.stringify([markers, arcs]);

  useEffect(() => {
    const h = host.current;
    if (!h) return;
    // Canvas créé hors de React : cobe le déplace dans un bloc à lui, React ne doit pas le gérer.
    const c = document.createElement('canvas');
    h.append(c);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // cobe multiplie lui-même la taille par la densité d'écran : on lui donne la taille CSS.
    const size = () => Math.max(1, Math.round(h.clientWidth));
    const dark = isDark();
    const g = createGlobe(c, {
      devicePixelRatio: dpr, width: size(), height: size(),
      phi: live.current.phi, theta: live.current.theta,
      dark: dark ? 1 : 0, diffuse: 1.2, mapSamples: 16000, mapBrightness: dark ? 5 : 6,
      baseColor: dark ? [0.25, 0.3, 0.4] : [1, 1, 1],
      markerColor: [1, 0.42, 0.24], glowColor: dark ? [0.15, 0.2, 0.3] : [0.85, 0.9, 1],
      arcColor: [1, 0.42, 0.24], arcWidth: 0.6, arcHeight: 0.25, markerElevation: 0.02,
      markers: [], arcs: [],
    });
    globe.current = g;

    let frame = 0;
    const tick = () => {
      const s = live.current;
      if (s.dragX === null) {
        // Glisse en douceur vers la personne choisie, par le chemin le plus court.
        let d = target.current[0] - s.phi;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.phi += d * 0.08;
        s.theta += (target.current[1] - s.theta) * 0.08;
      }
      g.update({ phi: s.phi, theta: s.theta });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const resize = new ResizeObserver(() => g.update({ width: size(), height: size() }));
    resize.observe(h);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      g.destroy();
      globe.current = null;
      h.replaceChildren();
    };
  }, []);

  // Points et arcs mis à jour sans recréer le globe.
  useEffect(() => {
    const [m, a] = JSON.parse(shape);
    globe.current?.update({ markers: m, arcs: a });
  }, [shape]);

  // Nouvelle personne choisie : le globe tourne vers elle.
  useEffect(() => {
    if (origin) target.current = anglesOf(origin.lat, origin.lon);
  }, [origin?.lat, origin?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rotation au doigt (horizontale ; le glissé vertical fait défiler la page).
  function down(e: React.PointerEvent) {
    live.current.dragX = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const s = live.current;
    if (s.dragX === null) return;
    s.phi += ((e.clientX - s.dragX) / e.currentTarget.clientWidth) * Math.PI;
    s.dragX = e.clientX;
  }
  function up() {
    const s = live.current;
    s.dragX = null;
    target.current = [s.phi, target.current[1]]; // reste là où on l'a lâché
  }

  return (
    <div className="globe-wrap">
      <div ref={host} className="globe-host" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="img" aria-label={`Globe : ${people.map(p => p.first_name).join(', ')}`} />
      {people.map(p => (
        <span key={p.id} className="globe-label" aria-hidden="true"
          style={{ positionAnchor: `--cobe-${anchor(p.id)}`, opacity: `var(--cobe-visible-${anchor(p.id)}, 0)` } as React.CSSProperties}>
          <Dot p={p} size={20} />{p.first_name}
        </span>
      ))}
      {origin && others.map(p => (
        <span key={'d' + p.id} className="globe-label globe-dist" aria-hidden="true"
          style={{ positionAnchor: `--cobe-arc-${anchor(p.id)}`, opacity: `var(--cobe-visible-arc-${anchor(p.id)}, 0)` } as React.CSSProperties}>
          {fmtKm(distanceKm([origin.lat, origin.lon], [p.lat, p.lon]))}
        </span>
      ))}
    </div>
  );
}
