'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { colorVar } from '@/lib/people';
import { distanceKm, fmtKm, greatCircle } from '@/lib/geo';

export type MapPerson = { id: string; first_name: string; color: string; lat: number; lon: number; avatar?: string };

const FRANCE: [[number, number], [number, number]] = [[-5.3, 41.3], [9.7, 51.2]];

// Fonds de carte OpenFreeMap : gratuits, sans clé, avec les noms des villes quand on zoome.
const styleUrl = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`;

const LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette pour zoomer la carte',
  'CooperativeGesturesHandler.MacHelpText': '⌘ + molette pour zoomer la carte',
  'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts pour bouger la carte (ou touche « Agrandir »)',
  'NavigationControl.ZoomIn': 'Zoomer',
  'NavigationControl.ZoomOut': 'Dézoomer',
  'NavigationControl.ResetBearing': 'Remettre le nord en haut',
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

  const origin = people.find(p => p.id === originId);
  const shape = JSON.stringify([people, originId]);

  // Création de la carte (bibliothèque chargée seulement ici : elle est lourde).
  useEffect(() => {
    let cancelled = false;
    let m: MapLibreMap | null = null;
    import('maplibre-gl').then(ml => {
      if (cancelled || !host.current) return;
      lib.current = ml;
      // Le worker est servi depuis public/ (voir scripts/copy-maplibre-worker.mjs).
      ml.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
      const start = origin ?? people[0];
      try {
        m = new ml.Map({
          container: host.current,
          style: styleUrl(isDark()),
          center: start ? [start.lon, start.lat] : [20, 30],
          zoom: 1.3,
          maxZoom: 13,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          locale: LOCALE,
        });
      } catch {
        setFailed(true);
        return;
      }
      m.addControl(new ml.NavigationControl({ visualizePitch: false }), 'top-right');
      // Les crédits de la carte restent accessibles (bouton ⓘ) sans masquer la carte au départ.
      m.on('load', () => host.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
      m.on('style.load', () => {
        m!.setProjection({ type: 'globe' });
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

  // Plein écran maison (marche aussi sur iPhone) : gestes libres, sinon deux doigts pour laisser défiler la page.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (full) m.cooperativeGestures.disable(); else m.cooperativeGestures.enable();
    const t = setTimeout(() => m.resize(), 50);
    document.documentElement.classList.toggle('map-open', full);
    return () => clearTimeout(t);
  }, [full, ready]);
  useEffect(() => () => document.documentElement.classList.remove('map-open'), []);

  function fitAll() {
    if (map.current && lib.current) frame(map.current, lib.current, people, 1500);
  }
  const me = people.find(p => p.id === meId);

  if (failed) {
    return <div className="empty">La carte 3D ne peut pas s&apos;afficher sur cet appareil (WebGL indisponible).</div>;
  }
  return (
    <div className={`map-wrap${full ? ' full' : ''}`}>
      <div ref={host} className="map-host" role="region" aria-label="Carte du monde avec la position de chacun" />
      <div className="map-tools">
        <button type="button" className="btn ghost sm" onClick={fitAll}>🌍 Tout le monde</button>
        {me && <button type="button" className="btn ghost sm" onClick={() => map.current?.flyTo({ center: [me.lon, me.lat], zoom: 9, duration: 2000 })}>📍 Moi</button>}
        <button type="button" className="btn ghost sm" onClick={() => map.current?.fitBounds(FRANCE, { padding: 20, duration: 2000 })}>🇫🇷 France</button>
        <button type="button" className="btn flame sm" onClick={() => setFull(f => !f)}>{full ? '✕ Fermer' : '⤢ Agrandir'}</button>
      </div>
    </div>
  );
}
