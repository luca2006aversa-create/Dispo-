'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './AppProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { currentPosition, distanceKm, geocodeCity, roundPos } from '@/lib/geo';

const MIN_MOVE_KM = 0.2;
const MAX_AGE_MS = 5 * 60_000;

/**
 * Tant que l'app est ouverte et que la personne partage sa position en direct,
 * envoie sa position quand elle a bougé de plus de 200 m ou toutes les 5 minutes.
 * Une app web ne peut pas suivre la position app fermée.
 */
export function LiveLocationTracker() {
  const { me, toast } = useApp();
  const last = useRef<{ lat: number; lon: number; at: number } | null>(null);

  useEffect(() => {
    if (!me.location_live || !('geolocation' in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      async p => {
        const pos = roundPos(p.coords.latitude, p.coords.longitude);
        const l = last.current;
        const now = Date.now();
        if (l && distanceKm([l.lat, l.lon], [pos.lat, pos.lon]) < MIN_MOVE_KM && now - l.at < MAX_AGE_MS) return;
        last.current = { ...pos, at: now };
        await supabaseBrowser().from('profiles')
          .update({ lat: pos.lat, lon: pos.lon, location_at: new Date(now).toISOString() }).eq('id', me.id);
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          toast('Position refusée par le téléphone : ta position en direct ne se met plus à jour.');
        }
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [me.id, me.location_live, toast]);

  return null;
}

/** Interrupteur « Partager ma position en direct », avec ce que ça implique. */
export function LiveLocationToggle() {
  const { me, toast } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const on = !!me.location_live;

  async function turnOn() {
    setBusy(true);
    try {
      const pos = await currentPosition();
      const { error } = await supabaseBrowser().from('profiles')
        .update({ location_live: true, lat: pos.lat, lon: pos.lon, location_at: new Date().toISOString() }).eq('id', me.id);
      if (error) toast("Ça n'a pas marché. La mise à jour Supabase de la position a-t-elle été lancée ?");
      else { toast('Position en direct activée 📍'); router.refresh(); }
    } catch (e) {
      const denied = e instanceof GeolocationPositionError && e.code === e.PERMISSION_DENIED;
      toast(denied
        ? "Le téléphone refuse la position. Autorise-la pour ce site dans les réglages du navigateur, puis réessaie."
        : "Impossible de trouver ta position pour l'instant. Réessaie dehors ou avec le Wi-Fi.");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    // Retour à la position de la ville (ou plus rien si pas de ville).
    const city = me.city ? await geocodeCity(me.city) : null;
    const { error } = await supabaseBrowser().from('profiles')
      .update({ location_live: false, lat: city?.lat ?? null, lon: city?.lon ?? null, location_at: null }).eq('id', me.id);
    setBusy(false);
    if (error) toast("Ça n'a pas marché, réessaie.");
    else { toast(city ? 'Position en direct arrêtée : le globe montre ta ville.' : 'Position en direct arrêtée.'); router.refresh(); }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <b>📍 Partager ma position en direct</b>
        <button type="button" role="switch" aria-checked={on} className={`switch${on ? ' on' : ''}`} disabled={busy}
          onClick={on ? turnOff : turnOn} aria-label="Partager ma position en direct" />
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {on
          ? 'Le groupe voit où tu es (à environ 100 m près). La position se met à jour quand ton app est ouverte. Coupe quand tu veux : le globe remontrera ta ville.'
          : 'Sinon, le globe montre ta ville. Si tu actives, le groupe verra où tu es (à environ 100 m près), mis à jour quand ton app est ouverte.'}
      </p>
    </div>
  );
}
