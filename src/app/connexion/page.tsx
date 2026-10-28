'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(/signup|not found|not allowed/i.test(error.message)
        ? "Cette adresse n'est pas invitée. Demande à Luca de t'ajouter."
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
      token: code.replace(/\D/g, ''),
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
              <input id="email" type="email" required autoComplete="email" inputMode="email"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
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
            <label htmlFor="code">
              Le code reçu par e-mail
              <input id="code" type="text" required autoComplete="one-time-code" inputMode="numeric"
                pattern="[0-9 ]{6,10}" maxLength={10} value={code} onChange={e => setCode(e.target.value)}
                placeholder="123456" style={{ letterSpacing: '.2em', fontWeight: 700 }} />
            </label>
            <button className="btn flame" type="submit" disabled={busy}>
              {busy ? 'Vérification…' : "C&apos;est parti"}
            </button>
            <button className="btn ghost sm" type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }}>
              Changer d&apos;adresse ou renvoyer un code
            </button>
          </form>
        )}
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
    </main>
  );
}
