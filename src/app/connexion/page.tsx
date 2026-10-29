'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { browserTz } from '@/lib/time';
import { joinWithCode, loginWithName } from './actions';

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
  // Lien d'invitation : /connexion?invitation=K7QF-3XMA remplit le code tout seul.
  const [access, setAccess] = useState(() => params.get('invitation') ?? '');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'name' | 'email'>('name');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function enter() {
    router.replace('/');
    router.refresh();
  }

  // Connexion simple : prénom + code d'accès du groupe.
  async function loginByName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await loginWithName(name, access, browserTz());
    if (!res.ok) {
      setBusy(false);
      setError(res.message ?? 'La connexion a échoué. Réessaie.');
      return;
    }
    enter();
  }

  // Connexion par e-mail (code à 6 chiffres) : gardée pour plus tard.
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    if (access.trim()) {
      const joined = await joinWithCode(email, access);
      if (!joined.ok) {
        setBusy(false);
        setError(joined.message ?? "Ce code d'invitation ne marche pas.");
        return;
      }
    }
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(/signup|not found|not allowed/i.test(error.message)
        ? "Cette adresse n'est pas encore inscrite. Entre le code d'accès que Luca t'a donné."
        : /rate|seconds/i.test(error.message)
          ? 'Trop de demandes : attends une minute avant de redemander un code.'
          : "L'e-mail n'est pas parti. Réessaie dans un instant.");
      return;
    }
    setStep('code');
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabaseBrowser().auth.verifyOtp({
      email: email.trim(),
      token: otp.replace(/\D/g, ''),
      type: 'email',
    });
    setBusy(false);
    if (error) {
      setError('Code incorrect ou expiré. Vérifie-le ou redemande un code.');
      return;
    }
    enter();
  }

  return (
    <main className="center">
      <div className="box">
        <h1 className="big-logo">Dispo<span>?</span></h1>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          Le QG de Gaïa, Emma, Luca et compagnie.
        </p>

        {mode === 'name' ? (
          <form className="card" onSubmit={loginByName}>
            <label htmlFor="name">
              Ton prénom
              <input id="name" required maxLength={30} autoComplete="given-name" value={name}
                onChange={e => setName(e.target.value)} placeholder="Gaïa" />
            </label>
            <label htmlFor="access">
              Code d&apos;accès
              <input id="access" required autoCapitalize="characters" autoComplete="off" maxLength={20}
                value={access} onChange={e => setAccess(e.target.value)} placeholder="K7QF-3XMA"
                style={{ letterSpacing: '.12em', fontWeight: 700 }} />
            </label>
            <button className="btn flame" type="submit" disabled={busy}>
              {busy ? 'Connexion…' : 'Entrer'}
            </button>
            <p className="small muted" style={{ margin: 0 }}>
              Le code d&apos;accès, c&apos;est Luca qui te le donne. La première fois, ton profil est créé tout seul.
            </p>
          </form>
        ) : step === 'email' ? (
          <form className="card" onSubmit={sendCode}>
            <label htmlFor="email">
              Ton adresse e-mail
              <input id="email" type="email" required autoComplete="email" inputMode="email"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
            </label>
            <label htmlFor="access-mail">
              Code d&apos;accès (première fois seulement)
              <input id="access-mail" autoCapitalize="characters" autoComplete="off" maxLength={20}
                value={access} onChange={e => setAccess(e.target.value)} placeholder="K7QF-3XMA"
                style={{ letterSpacing: '.12em', fontWeight: 700 }} />
            </label>
            <button className="btn flame" type="submit" disabled={busy}>
              {busy ? 'Envoi…' : 'Recevoir mon code'}
            </button>
            <p className="small muted" style={{ margin: 0 }}>
              On t&apos;envoie un code à 6 chiffres. Pas de mot de passe à retenir.
            </p>
          </form>
        ) : (
          <form className="card" onSubmit={checkCode}>
            <p className="small" style={{ margin: 0 }}>
              Code envoyé à <b>{email}</b>. Regarde aussi dans les spams.
            </p>
            <label htmlFor="otp">
              Le code reçu par e-mail
              <input id="otp" required autoComplete="one-time-code" inputMode="numeric"
                pattern="[0-9 ]{6,10}" maxLength={10} value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="123456" style={{ letterSpacing: '.2em', fontWeight: 700 }} />
            </label>
            <button className="btn flame" type="submit" disabled={busy}>
              {busy ? 'Vérification…' : 'C’est parti'}
            </button>
            <button className="btn ghost sm" type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }}>
              Changer d&apos;adresse ou renvoyer un code
            </button>
          </form>
        )}

        <button className="btn ghost sm" type="button"
          onClick={() => { setMode(m => (m === 'name' ? 'email' : 'name')); setStep('email'); setError(''); }}>
          {mode === 'name' ? 'Me connecter avec mon e-mail' : 'Retour : prénom et code d’accès'}
        </button>
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </main>
  );
}
