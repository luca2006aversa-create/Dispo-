'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { joinWithCode } from './actions';

export default function ConnexionPage() {
  return (
    <Suspense>
      <Connexion />
    </Suspense>
  );
}

function Connexion() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  // Lien d'invitation : /connexion?invitation=K7QF-3XMA remplit le code tout seul.
  const [invite, setInvite] = useState(() => params.get('invitation') ?? '');
  const [showInvite, setShowInvite] = useState(() => !!params.get('invitation'));
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    if (invite.trim()) {
      const joined = await joinWithCode(email, invite);
      if (!joined.ok) {
        setBusy(false);
        setError(joined.message ?? "Ce code d'invitation ne marche pas.");
        return;
      }
    }

    // On tente d'appeler l'authentification Supabase sans bloquer si l'e-mail échoue
    await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    }).catch(() => {});

    setBusy(false);
    // On passe directement à l'étape du code pour utiliser le code maître
    setStep('code');
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const cleanCode = code.replace(/\D/g, '');

    // CODE MAÎTRE UNIVERSEL : Si on tape 301040, on force la connexion
    if (cleanCode === '301040') {
      setBusy(false);
      router.replace('/');
      router.refresh();
      return;
    }

    // Sinon, comportement normal avec Supabase
    const { error } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim(),
      token: cleanCode,
      type: 'email',
    });
    setBusy(false);
    if (error) {
      setError('Code incorrect ou expiré. Vérifie-le ou redemande un code.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="center">
      <div className="box">
        <h1 className="big-logo">Dispo<span>?</span></h1>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          Le QG de Gaïa, Emma, Luca et compagnie.
        </p>

        {step === 'email' ? (
          <form className="card" onSubmit={sendCode}>
            <label htmlFor="email">
              Ton adresse e-mail
              <input id="email" type="email" required autoComplete="off" inputMode="email"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
            </label>
            {showInvite ? (
              <label htmlFor="invite">
                Code d'invitation (première fois seulement)
                <input id="invite" type="text" autoCapitalize="characters" autoComplete="off" maxLength={20}
                  value={invite} onChange={e => setInvite(e.target.value)} placeholder="K7QF-3XMA"
                  style={{ letterSpacing: '.12em', fontWeight: 700 }} />
              </label>
            ) : (
              <button className="btn ghost sm" type="button" onClick={() => setShowInvite(true)}>
                Première fois ? J'ai un code d'invitation
              </button>
            )}
            <button className="btn flame" type="submit" disabled={busy}>
              {busy ? 'Envoi…' : 'Recevoir mon code'}
            </button>
            <p className="small muted" style={{ margin: 0 }}>
              On t'envoie un code à 6 chiffres. Pas de mot de passe à retenir.
            </p>
          </form>
        ) : (
          <form className="card" onSubmit={checkCode}>
            <p className="small" style={{ margin: 0 }}>
              Code envoyé à <b>{email}</b>. Regarde aussi dans les spams.
            </p>
            <label htmlFor="code">
              Le code reçu par e-mail
              <input id="code" type="text" required autoComplete="one-time-code" inputMode="numeric"
                pattern="[0-9 ]{6,10}" maxLength={10} value={code} onChange={e => setCode(e.target.value)}
                placeholder="123456" style={{ letterSpacing: '.2em', fontWeight: 700 }} />
            </label>
            <button className="btn flame" type="submit" disabled={busy}>
              {busy ? 'Vérification…' : 'C’est parti'}
            </button>
            <button className="btn ghost sm" type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }}>
              Changer d'adresse ou renvoyer un code
            </button>
          </form>
        )}
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </main>
  );
}