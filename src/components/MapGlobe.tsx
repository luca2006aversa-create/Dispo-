'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { colorVar } from '@/lib/people';
import { distanceKm, fmtKm, greatCircle } from '@/lib/geo';
import { DOT_STEPS, MAP_Z, PALETTE, dotImage, dottedStyle } from '@/lib/mapStyle';
import { FRANCE_BOUNDS } from '@/lib/france';
import { VIETNAM_BOUNDS } from '@/lib/vietnam';

// Centre de la France métropolitaine : le bouton FR y amène, au niveau où la vraie carte remplace les points.
const FRANCE_CENTER: [number, number] = [(FRANCE_BOUNDS[0][0] + FRANCE_BOUNDS[1][0]) / 2, (FRANCE_BOUNDS[0][1] + FRANCE_BOUNDS[1][1]) / 2];

export type MapPerson = { id: string; first_name: string; color: string; lat: number; lon: number; avatar?: string };


// Fonds de carte OpenFreeMap : gratuits, sans clé, avec les noms des villes quand on zoome.
const styleUrl = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`;

const LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette pour zoomer la carte',
  'CooperativeGesturesHandler.MacHelpText': '⌘ + molette pour zoomer la carte',
  'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts pour bouger la carte (ou touche « Agrandir »)',
};

function isDark() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

function pinElement(p: MapPerson) {
  const el = document.createElement('div');
  el.className = 'map-pin';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = colorVar(p.color);
  if (p.avatar) {
    const img = document.createElement('img');
    img.src = p.avatar;
    img.alt = '';
    dot.append(img);
  } else {
    dot.textContent = p.first_name[0]?.toUpperCase() ?? '?';
  }
  const name = document.createElement('span');
  name.className = 'map-name';
  name.textContent = p.first_name;
  el.append(dot, name);
  return el;
}

/** Cadre la carte pour voir tout le monde (ou la seule personne placée). */
function frame(m: MapLibreMap, ml: typeof import('maplibre-gl'), people: MapPerson[], duration: number) {
  if (!people.length) return;
  if (people.length === 1) { m.easeTo({ center: [people[0].lon, people[0].lat], zoom: 4, duration }); return; }
  const b = new ml.LngLatBounds();
  people.forEach(p => b.extend([p.lon, p.lat]));
  m.fitBounds(b, { padding: 70, maxZoom: 5, duration });
}

/**
 * Carte 3D en vue globe (MapLibre) : on la tourne, on zoome jusqu'aux villes.
 * Une pastille par personne, des arcs depuis `originId` avec la distance au milieu.
 */
export function MapGlobe({ people, originId, meId }: { people: MapPerson[]; originId?: string; meId: string }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const lib = useRef<typeof import('maplibre-gl') | null>(null);
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bearing, setBearing] = useState(0);
  // Boutons flottants seulement quand la carte est bien à l'écran.
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6, 1] });
    io.observe(host.current);
    return () => io.disconnect();
  }, []);

  const origin = people.find(p => p.id === originId);
  const shape = JSON.stringify([people, originId]);

  // Création de la carte (bibliothèque chargée seulement ici : elle est lourde).
  useEffect(() => {
    let cancelled = false;
    let m: MapLibreMap | null = null;
    const dark = isDark();
    const pal = PALETTE[dark ? 'dark' : 'light'];
    Promise.all([import('maplibre-gl'), fetch(styleUrl(dark)).then(r => r.json())]).then(([ml, base]) => {
      if (cancelled || !host.current) return;
      lib.current = ml;
      // Le worker est servi depuis public/ (voir scripts/copy-maplibre-worker.mjs).
      ml.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
      const start = origin ?? people[0];
      try {
        m = new ml.Map({
          container: host.current,
          style: dottedStyle(base, pal),
          center: start ? [start.lon, start.lat] : [20, 30],
          zoom: 1.2,
          maxZoom: 13,
          // Dans la page : rotation au doigt gérée plus bas, la molette fait défiler la page.
          dragPan: false,
          scrollZoom: false,
          attributionControl: { compact: true },
          locale: LOCALE,
        });
      } catch {
        setFailed(true);
        return;
      }
      m.on('rotate', () => setBearing(m!.getBearing()));
      // Les crédits de la carte restent accessibles (bouton ⓘ) sans masquer la carte au départ.
      m.on('load', () => host.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
      m.on('style.load', () => {
        m!.setProjection({ type: 'globe' });
        // Motifs de points : gris pour le monde, orange (un peu plus gros) pour la France.
        for (const step of DOT_STEPS) {
          if (!m!.hasImage(`dot-${step.id}`)) m!.addImage(`dot-${step.id}`, dotImage(step.spacing, step.r, pal.dots), { pixelRatio: 2 });
          if (!m!.hasImage(`fr-${step.id}`)) m!.addImage(`fr-${step.id}`, dotImage(step.spacing, step.r * 1.25, pal.france), { pixelRatio: 2 });
        }
        // Noms des pays, villes, mers… en français quand ils existent (sinon le nom local).
        for (const layer of m!.getStyle().layers) {
          if (layer.type !== 'symbol' || /shield|highway/.test(layer.id) || !m!.getLayoutProperty(layer.id, 'text-field')) continue;
          m!.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']]);
        }
        setReady(true);
      });
      map.current = m;
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      markers.current.forEach(x => x.remove());
      markers.current = [];
      m?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pastilles, arcs et distances : redessinés quand les positions ou la personne choisie changent.
  useEffect(() => {
    const m = map.current, ml = lib.current;
    if (!ready || !m || !ml) return;
    markers.current.forEach(x => x.remove());
    markers.current = people.map(p => new ml.Marker({ element: pinElement(p), anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(m));

    const others = origin ? people.filter(p => p.id !== origin.id) : [];
    const lines = others.map(p => greatCircle([origin!.lat, origin!.lon], [p.lat, p.lon]));
    for (const [i, p] of others.entries()) {
      // Étiquettes décalées le long de leur arc pour ne pas se chevaucher quand les arcs sont proches.
      const mid = lines[i][Math.floor((lines[i].length - 1) * (0.3 + (0.4 * (i + 1)) / (others.length + 1)))];
      const el = document.createElement('div');
      el.className = 'map-km';
      el.textContent = fmtKm(distanceKm([origin!.lat, origin!.lon], [p.lat, p.lon]));
      markers.current.push(new ml.Marker({ element: el }).setLngLat(mid).addTo(m));
    }
    const data = {
      type: 'FeatureCollection' as const,
      features: lines.map(coordinates => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } })),
    };
    const src = m.getSource('arcs') as { setData?: (d: typeof data) => void } | undefined;
    if (src?.setData) src.setData(data);
    else {
      m.addSource('arcs', { type: 'geojson', data });
      m.addLayer({ id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#FF6B3D', 'line-width': 2.5, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.9 } });
    }
    frame(m, ml, people, 1200);
  }, [ready, shape]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plein écran maison (marche aussi sur iPhone) : tous les gestes de la carte.
  // Dans la page : notre propre rotation (ci-dessous), pour que la page continue de défiler.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (full) { m.dragPan.enable(); m.scrollZoom.enable(); } else { m.dragPan.disable(); m.scrollZoom.disable(); }
    const t = setTimeout(() => m.resize(), 50);
    document.documentElement.classList.toggle('map-open', full);
    return () => clearTimeout(t);
  }, [full, ready]);
  useEffect(() => () => document.documentElement.classList.remove('map-open'), []);

  // Rotation de la Terre dans la page : un doigt (ou la souris) qui glisse à gauche ou à droite la fait tourner,
  // la Terre suit le doigt et continue un peu sur sa lancée. Au doigt, haut/bas reste le défilement de la page
  // (touch-action: pan-y) ; à la souris, haut/bas incline la Terre. Deux doigts : zoom (géré par la carte).
  useEffect(() => {
    const el = host.current, m = map.current;
    if (!el || !m || full) return;
    const pointers = new Set<number>();
    let last: { x: number; y: number; t: number } | null = null;
    // Derniers déplacements (degrés, instant) : la vitesse au lâcher est mesurée sur les 100 dernières ms.
    let trail: { lon: number; lat: number; t: number }[] = [];
    // Environ la vitesse du doigt à la surface du globe (un peu moins, pour garder le contrôle).
    const degPerPx = () => (0.75 * 360) / (512 * 2 ** m.getZoom()) / Math.max(0.35, Math.cos((m.getCenter().lat * Math.PI) / 180));

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointers.add(e.pointerId);
      if (pointers.size > 1) { last = null; return; } // deux doigts : c'est un zoom
      m.stop();
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      trail = [];
    };
    const move = (e: PointerEvent) => {
      if (!last || pointers.size > 1 || !pointers.has(e.pointerId)) return;
      const k = degPerPx();
      const dLon = -(e.clientX - last.x) * k;
      const dLat = e.pointerType === 'mouse' ? (e.clientY - last.y) * k * 0.7 : 0;
      const c = m.getCenter();
      m.jumpTo({ center: [c.lng + dLon, Math.max(-75, Math.min(75, c.lat + dLat))] });
      trail.push({ lon: dLon, lat: dLat, t: e.timeStamp });
      trail = trail.filter(p => e.timeStamp - p.t < 100);
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (!last) return;
      const recent = trail.filter(p => e.timeStamp - p.t < 100);
      last = null;
      if (!recent.length) return;
      // Élan : la Terre continue un peu sur sa lancée (au plus un quart de tour), puis s'arrête en douceur.
      const span = Math.max(16, e.timeStamp - recent[0].t);
      const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
      const glideLon = clamp((recent.reduce((a, p) => a + p.lon, 0) / span) * 220, 90);
      const glideLat = clamp((recent.reduce((a, p) => a + p.lat, 0) / span) * 220, 20);
      if (Math.abs(glideLon) < 1 && Math.abs(glideLat) < 1) return;
      const c = m.getCenter();
      m.easeTo({ center: [c.lng + glideLon, clamp(c.lat + glideLat, 75)], duration: 900, easing: t => 1 - (1 - t) ** 3 });
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [full, ready]);

  function fitAll() {
    if (map.current && lib.current) frame(map.current, lib.current, people, 1500);
  }
  const me = people.find(p => p.id === meId);

  if (failed) {
    return <div className="empty">La carte 3D ne peut pas s&apos;afficher sur cet appareil (WebGL indisponible).</div>;
  }
  const m = map.current;
  return (
    <div className={`map-wrap${full ? ' full' : ''}`}>
      <div ref={host} className="map-host" role="region" aria-label="Carte du monde avec la position de chacun" />
      {(onScreen || full) && ready && createPortal(
        <div className="map-fab" role="toolbar" aria-label="Commandes de la carte">
          <button type="button" aria-label="Zoomer" onClick={() => m?.zoomIn()}>＋</button>
          <button type="button" aria-label="Dézoomer" onClick={() => m?.zoomOut()}>－</button>
          <button type="button" aria-label="Remettre le nord en haut" onClick={() => m?.resetNorthPitch()}>
            <span style={{ display: 'inline-block', transform: `rotate(${-bearing}deg)`, transition: 'transform .1s' }}>🧭</span>
          </button>
          <span className="sep" aria-hidden="true" />
          <button type="button" aria-label="Voir tout le monde" onClick={fitAll}>🌍</button>
          {me && <button type="button" aria-label="Aller sur moi" onClick={() => m?.flyTo({ center: [me.lon, me.lat], zoom: 9, duration: 2000 })}>📍</button>}
          <button type="button" aria-label="Aller sur la France" onClick={() => m?.flyTo({ center: FRANCE_CENTER, zoom: MAP_Z + 0.15, duration: 2400 })}>FR</button>
          <button type="button" aria-label="Aller sur le Vietnam" onClick={() => m?.fitBounds(VIETNAM_BOUNDS, { padding: 16, duration: 2400 })}>VN</button>
          <button type="button" aria-label={full ? 'Fermer le plein écran' : 'Plein écran'} className={full ? 'on' : ''} onClick={() => setFull(f => !f)}>
            {full ? '✕' : '⤢'}
          </button>
        </div>,
        // À la racine de la page : sinon la section (transformée) enfermerait ces boutons « fixes ».
        document.body,
      )}
    </div>
  );
}
