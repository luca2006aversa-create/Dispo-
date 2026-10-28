'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { regenerateInviteCode } from './actions';

/** Code d'invitation du groupe (admin seulement) : à partager pour que les potes créent leur compte. */
export function InviteCode() {
  const { groupId, toast } = useApp();
  const [code, setCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser().from('group_invite_codes').select('code').eq('group_id', groupId).maybeSingle();
    setCode(data?.code ?? null);
    setLoaded(true);
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const link = code ? `${location.origin}/connexion?invitation=${code}` : '';

  async function regenerate() {
    setBusy(true);
    setError('');
    const res = await regenerateInviteCode(groupId);
    setBusy(false);
    if (res.error) setError(res.error);
    else { setCode(res.code!); toast(code ? "Nouveau code : l'ancien ne marche plus" : 'Code créé'); }
  }

  async function share() {
    const text = `Rejoins-nous sur Dispo ? Ton code d'invitation : ${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Dispo ?', text, url: link }); return; }
      await navigator.clipboard.writeText(`${text}\n${link}`);
      toast('Lien copié, colle-le dans un message');
    } catch {
      // Partage annulé : rien à faire.
    }
  }

  if (!loaded) return null;
  return (
    <div className="card">
      <h3>Code d&apos;invitation</h3>
      {code ? (
        <>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '.12em', textAlign: 'center' }}>{code}</div>
          <p className="small muted" style={{ margin: 0 }}>
            Envoie ce code (ou le lien) à tes potes : ils entrent leur e-mail et ce code sur l&apos;écran de connexion, et leur compte est créé.
            Si le code circule trop, change-le : l&apos;ancien ne marchera plus.
          </p>
          <div className="row">
            <button className="btn flame" type="button" onClick={share}>Partager le lien</button>
            <button className="btn ghost sm" type="button" onClick={regenerate} disabled={busy}>Changer le code</button>
          </div>
        </>
      ) : (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Crée un code à envoyer à tes potes : avec lui, ils créent leur compte tout seuls, sans que tu aies à entrer leur adresse.
          </p>
          <button className="btn flame" type="button" onClick={regenerate} disabled={busy}>{busy ? 'Création…' : 'Créer un code'}</button>
        </>
      )}
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
