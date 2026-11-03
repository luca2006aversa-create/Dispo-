'use client';

import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { useApp } from './AppProvider';
import { colorRgb } from '@/lib/people';

function isDark() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Globe en fond d'écran, derrière toutes les pages : un point par personne, des arcs depuis soi,
 * une rotation lente. Décoratif (non cliquable). Sur l'accueil, il rapetisse et s'efface en bas de page
 * (variable CSS --fin) pour laisser la place à la carte interactive.
 */
export function BackgroundGlobe() {
  const { me, members } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<ReturnType<typeof createGlobe> | null>(null);

  const placed = members.filter(m => m.lat != null && m.lon != null);
  const mine = placed.find(m => m.id === me.id);
  const markers = placed.map(m => ({
    location: [Number(m.lat), Number(m.lon)] as [number, number], size: m.id === me.id ? 0.08 : 0.06, color: colorRgb(m.color),
  }));
  const arcs = mine ? placed.filter(m => m.id !== me.id).map(m => ({
    from: [Number(mine.lat), Number(mine.lon)] as [number, number], to: [Number(m.lat), Number(m.lon)] as [number, number],
  })) : [];
  const shape = JSON.stringify([markers, arcs]);
  // Le globe démarre tourné vers soi.
  const startPhi = mine ? Math.PI - ((Number(mine.lon) * Math.PI) / 180 - Math.PI / 2) : 0;

  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const c = document.createElement('canvas');
    h.append(c);
    const dark = isDark();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = () => Math.max(1, Math.round(h.clientWidth));
    let phi = startPhi;
    const g = createGlobe(c, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), width: size(), height: size(),
      phi, theta: 0.3, dark: dark ? 1 : 0, diffuse: 1.2, mapSamples: 12000, mapBrightness: dark ? 4 : 5,
      baseColor: dark ? [0.25, 0.3, 0.42] : [0.9, 0.93, 1], markerColor: [1, 0.42, 0.24],
      glowColor: dark ? [0.12, 0.17, 0.28] : [0.82, 0.88, 1], arcColor: [1, 0.42, 0.24], arcWidth: 0.5, arcHeight: 0.25,
      markers: [], arcs: [],
    });
    globe.current = g;
    let frame = 0;
    const tick = () => {
      if (!still) phi += 0.0012;
      g.update({ phi });
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const [m, a] = JSON.parse(shape);
    globe.current?.update({ markers: m, arcs: a });
  }, [shape]);

  return <div ref={host} className="bg-globe" aria-hidden="true" />;
}
