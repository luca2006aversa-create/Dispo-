// Style de la carte du globe : la Terre en pointillés qui se resserrent par paliers en zoomant,
// la France en points orange avec son contour, puis, de près, la vraie carte de la France
// pendant que le reste du monde s'estompe.

import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import { FRANCE_POLYGONS } from './france';
import { VIETNAM_POLYGONS } from './vietnam';

/** Pays mis en avant : points orange, contour, puis vraie carte quand ils remplissent l'écran. */
const FOCUS = [
  { id: 'france', polygons: FRANCE_POLYGONS },
  { id: 'vietnam', polygons: VIETNAM_POLYGONS },
];

/** À partir de ce zoom, les pointillés laissent place à la carte détaillée… */
export const DETAIL_Z = 4;
/** …qui est complète ici (la France occupe alors à peu près la largeur d'un téléphone). */
export const MAP_Z = 4.6;
/** Les détails de la carte (routes, zones…) n'apparaissent qu'à la fin du fondu, pour une transition nette. */
const DETAIL_LAYERS_Z = 4.3;

export type Palette = { dots: string; france: string; ocean: string; page: string; flame: string };
export const PALETTE: Record<'light' | 'dark', Palette> = {
  light: { dots: '#7D8AA3', france: '#FF6B3D', ocean: '#DCE4EF', page: '#EEF2F7', flame: '#E8552B' },
  dark: { dots: '#5F6D88', france: '#FF7D4D', ocean: '#172036', page: '#0F1420', flame: '#FF7D4D' },
};

/** Paliers de pointillés : espacement (px) et rayon des points, du plus clairsemé au plus dense. */
export const DOT_STEPS = [
  { id: 1, spacing: 4, r: 0.75 },
  { id: 2, spacing: 3, r: 0.65 },
  { id: 3, spacing: 2.2, r: 0.55 },
];
const DOT_ZOOMS = [1.8, 2.8]; // passage au palier suivant

/** Image d'un motif de points (un point centré dans une case), en haute résolution. */
export function dotImage(spacing: number, r: number, color: string, pixelRatio = 2) {
  const size = Math.round(spacing * pixelRatio);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.beginPath();
  x.arc(size / 2, size / 2, r * pixelRatio, 0, Math.PI * 2);
  x.fill();
  return x.getImageData(0, 0, size, size);
}

const stepPattern = (prefix: string) =>
  ['step', ['zoom'], `${prefix}-1`, DOT_ZOOMS[0], `${prefix}-2`, DOT_ZOOMS[1], `${prefix}-3`] as unknown as string;

const fade = (a: number, va: number | string, b: number, vb: number | string) =>
  ['interpolate', ['linear'], ['zoom'], a, va, b, vb] as unknown as number;

/** Le monde entier moins les pays mis en avant : sert à estomper les autres pays quand on est sur l'un d'eux. */
function outsideFocus() {
  const world: [number, number][] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const holes = FOCUS.flatMap(c => c.polygons.map(p => [...p[0]].reverse()));
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [world, ...holes] } };
}

/** Transforme un style OpenFreeMap (positron ou dark) en globe pointillé avec mise en avant de la France et du Vietnam. */
export function dottedStyle(base: StyleSpecification, pal: Palette): StyleSpecification {
  const layers: LayerSpecification[] = [];
  const franceDotsOpacity = ['interpolate', ['linear'], ['zoom'], 1.4, 0, 2.2, 1, DETAIL_Z, 1, MAP_Z, 0] as unknown as number;
  const france: LayerSpecification[] = FOCUS.flatMap(c => [
    // Fond uni sous les points orange : cache les points gris du monde à l'intérieur du pays.
    { id: `${c.id}-under`, type: 'fill', source: c.id, paint: { 'fill-color': pal.page, 'fill-opacity': franceDotsOpacity } },
    { id: `${c.id}-dots`, type: 'fill', source: c.id, paint: { 'fill-pattern': stepPattern('fr'), 'fill-opacity': franceDotsOpacity } },
  ] as LayerSpecification[]);
  let franceAdded = false;

  for (const layer of base.layers) {
    if (layer.type === 'raster' || layer.type === 'hillshade') continue;
    if (layer.type === 'background') {
      const land = (layer.paint as { 'background-color'?: string } | undefined)?.['background-color'] ?? pal.page;
      // De loin : pas de fond (la Terre flotte sur l'app). De près : la couleur des terres.
      layers.push({ ...layer, paint: { 'background-color': fade(DETAIL_Z, 'rgba(0,0,0,0)', MAP_Z, land) as unknown as string } });
      layers.push({
        id: 'land-dots', type: 'background',
        paint: { 'background-pattern': stepPattern('dot'), 'background-opacity': fade(DETAIL_Z, 1, MAP_Z, 0) },
      });
      continue;
    }
    if (layer.id === 'water') {
      const water = (layer.paint as { 'fill-color'?: string } | undefined)?.['fill-color'] ?? pal.ocean;
      layers.push({ ...layer, paint: { 'fill-antialias': false, 'fill-color': fade(DETAIL_Z, pal.ocean, MAP_Z, water) as unknown as string } } as LayerSpecification);
      continue;
    }
    if (layer.type === 'symbol') {
      // Les points orange de la France passent sous les noms.
      if (!franceAdded) { layers.push(...france); franceAdded = true; }
      // Noms de régions : seulement sur la carte détaillée (ils encombrent la vue en pointillés).
      layers.push(/state/.test(layer.id) ? { ...layer, minzoom: Math.max(layer.minzoom ?? 0, DETAIL_Z) } as LayerSpecification : layer);
      continue;
    }
    // Routes, forêts, bâtiments, frontières… seulement sur la carte détaillée.
    // Les zones (habitations, parcs…) attendent d'être assez près pour ne pas faire des taches.
    const min = /landuse|park|landcover/.test(layer.id) ? 8 : DETAIL_LAYERS_Z;
    layers.push({ ...layer, minzoom: Math.max(layer.minzoom ?? 0, min) } as LayerSpecification);
  }
  if (!franceAdded) layers.push(...france);

  layers.push(
    { id: 'outside-focus', type: 'fill', source: 'outside-focus',
      paint: { 'fill-color': pal.page, 'fill-opacity': fade(DETAIL_Z, 0, MAP_Z, 0.62) } },
    ...FOCUS.map(c => ({ id: `${c.id}-line`, type: 'line', source: c.id, layout: { 'line-join': 'round' },
      paint: { 'line-color': pal.flame, 'line-opacity': fade(1.8, 0, 2.6, 1), 'line-width': fade(3, 1, 8, 2.5) } }) as LayerSpecification),
  );

  return {
    ...base,
    sources: {
      ...base.sources,
      ...Object.fromEntries(FOCUS.map(c => [c.id,
        { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: c.polygons } } }])),
      'outside-focus': { type: 'geojson', data: outsideFocus() },
    },
    layers,
  };
}
