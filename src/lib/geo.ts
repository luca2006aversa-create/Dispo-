// Positions et distances : la ville de chacun sur le globe.

export type LatLon = [number, number];

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance à vol d'oiseau (grand cercle) entre deux points, en kilomètres. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** « 590 km », « 9 840 km », « 3,4 km » */
export function fmtKm(km: number): string {
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km).toLocaleString('fr-FR')} km`;
}

/** Position du téléphone (avec sa permission), arrondie à 0,001° (environ 100 m). */
export function currentPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('indisponible')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve(roundPos(p.coords.latitude, p.coords.longitude)),
      reject,
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
    );
  });
}

export const roundPos = (lat: number, lon: number) =>
  ({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 });

/** Cherche une ville (service gratuit Open-Meteo, sans clé). Coordonnées arrondies à 0,01° (environ 1 km). */
export async function geocodeCity(name: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=fr&format=json`,
    );
    if (!res.ok) return null;
    const hit = (await res.json()).results?.[0];
    if (!hit) return null;
    const round = (n: number) => Math.round(n * 100) / 100;
    return { lat: round(hit.latitude), lon: round(hit.longitude), label: [hit.name, hit.country].filter(Boolean).join(', ') };
  } catch {
    return null;
  }
}
