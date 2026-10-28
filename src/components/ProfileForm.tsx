'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { COLORS, colorVar, type Profile } from '@/lib/people';
import { browserTz } from '@/lib/time';

/** Création (écran de bienvenue) ou modification (réglages) de son profil. */
export function ProfileForm({ userId, initial }: { userId: string; initial?: Profile }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [color, setColor] = useState(initial?.color ?? 'bleu');
  const [city, setCity] = useState(initial?.city ?? '');
  const [tz, setTz] = useState(initial?.timezone ?? 'Europe/Paris');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Le fuseau du navigateur n'est connu qu'une fois la page affichée.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!initial) setTz(browserTz());
  }, [initial]);

  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return all.includes(tz) ? all : [tz, ...all];
  }, [tz]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('profiles').upsert({
      id: userId, first_name: firstName.trim(), color, city: city.trim(), timezone: tz,
    });
    if (error) {
      setBusy(false);
      setError("L'enregistrement n'a pas marché. Réessaie.");
      return;
    }
    if (!initial) {
      const { data: groups } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
      if (!groups?.length) {
        const { error: e2 } = await supabase.rpc('create_first_group');
        if (e2) {
          setBusy(false);
          setError("Tu n'es encore dans aucun groupe. Demande à Luca de t'inviter.");
          return;
        }
      }
      router.replace('/');
      router.refresh();
      return;
    }
    setBusy(false);
    setMsg('Profil enregistré');
    router.refresh();
  }

  return (
    <form className="card" onSubmit={save}>
      <label htmlFor="pf-name">
        Ton prénom
        <input id="pf-name" required maxLength={30} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
      </label>
      <div className="block" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }} id="pf-color">Ta couleur</span>
        <div className="chips" role="group" aria-labelledby="pf-color">
          {COLORS.map(c => (
            <button key={c.key} type="button" className="swatch" aria-label={c.label} aria-pressed={color === c.key}
              style={{ background: colorVar(c.key) }} onClick={() => setColor(c.key)} />
          ))}
        </div>
      </div>
      <label htmlFor="pf-city">
        Ta ville
        <input id="pf-city" maxLength={40} value={city} onChange={e => setCity(e.target.value)} placeholder="Toulouse" autoComplete="address-level2" />
      </label>
      <label htmlFor="pf-tz">
        Ton fuseau horaire (détecté automatiquement)
        <select id="pf-tz" value={tz} onChange={e => setTz(e.target.value)}>
          {zones.map(z => <option key={z} value={z}>{z.replaceAll('_', ' ')}</option>)}
        </select>
      </label>
      <button className="btn flame" type="submit" disabled={busy}>
        {busy ? 'Enregistrement…' : initial ? 'Enregistrer' : "C'est moi !"}
      </button>
      {msg && <p className="small" role="status" style={{ margin: 0 }}>{msg}</p>}
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </form>
  );
}
