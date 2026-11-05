'use client';

import { useEffect, useState } from 'react';
import { passwordStatus, removeOwnPassword, setOwnPassword, type PasswordStatus } from './actions';

/** Mot de passe facultatif des comptes « prénom + code » : une fois choisi, il est demandé à la connexion. */
export function PasswordSetting() {
  const [status, setStatus] = useState<PasswordStatus | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { passwordStatus().then(setStatus).catch(() => {}); }, []);
  if (!status?.nameAccount) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await setOwnPassword(password);
    setResult(res);
    if (res.ok) { setPassword(''); setStatus({ ...status!, hasPassword: true }); }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    const res = await removeOwnPassword();
    setResult(res);
    if (res.ok) setStatus({ ...status!, hasPassword: false });
    setBusy(false);
  }

  return (
    <div className="block">
      <h3>Mot de passe</h3>
      <form className="card" onSubmit={save}>
        <p className="small muted" style={{ margin: 0 }}>
          {status.hasPassword
            ? 'Ton compte est protégé : ton mot de passe est demandé quand tu te connectes avec ton prénom.'
            : "Sans mot de passe, n'importe qui ayant le code d'accès peut entrer avec ton prénom. Choisis-en un pour protéger ton compte."}
        </p>
        <label htmlFor="new-password">
          {status.hasPassword ? 'Nouveau mot de passe' : 'Choisir un mot de passe'}
          <input id="new-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password"
            value={password} onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" />
        </label>
        <button className="btn flame" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        {status.hasPassword && (
          <button className="btn ghost sm" type="button" disabled={busy} onClick={remove}>Retirer mon mot de passe</button>
        )}
        {result && <p className={result.ok ? 'small' : 'error'} role="status" style={{ margin: 0 }}>{result.message}</p>}
      </form>
    </div>
  );
}
