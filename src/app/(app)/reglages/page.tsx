'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LATEST, RELEASES } from '@/lib/changelog';
import { useApp } from '@/components/AppProvider';
import { Dot } from '@/components/Dot';
import { ProfileForm } from '@/components/ProfileForm';
import { supabaseBrowser } from '@/lib/supabase/client';
import { invite } from './actions';
import { InviteCode } from './InviteCode';
import { AvatarPicker } from './AvatarPicker';
import { PasswordSetting } from './PasswordSetting';
import { LiveLocationToggle } from '@/components/LiveLocation';
import { NotificationToggle } from '@/components/Notifications';

type Theme = 'auto' | 'light' | 'dark';

export default function Reglages() {
  const { me, members, groupId } = useApp();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('auto');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    // Préférence propre au navigateur, lue après l'affichage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setTheme((localStorage.getItem('theme') as Theme) || 'auto'); } catch {}
  }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    try { if (t === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', t); } catch {}
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(await invite(groupId, email));
    setBusy(false);
    setEmail('');
    router.refresh();
  }

  async function logout() {
    // Seulement cet appareil : les autres (téléphone, app installée…) restent connectés.
    await supabaseBrowser().auth.signOut({ scope: 'local' });
    router.replace('/connexion');
    router.refresh();
  }

  return (
    <section className="tab">
      <div className="block">
        <h1>Mon profil</h1>
        <AvatarPicker />
        <NotificationToggle />
        <LiveLocationToggle />
        <ProfileForm userId={me.id} initial={me} />
      </div>

      <PasswordSetting />

      <div className="block">
        <h3>Thème</h3>
        <div className="chips" role="group" aria-label="Thème">
          {([['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']] as const).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={theme === k} onClick={() => applyTheme(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="block">
        <h3>Le groupe</h3>
        <div className="list">
          {members.map(m => (
            <div key={m.id} className="item">
              <Dot p={m} size={28} zoom />
              <div className="grow"><b>{m.first_name}</b> <span className="small muted">{m.city}{m.role === 'admin' ? ' · admin' : ''}</span></div>
            </div>
          ))}
        </div>
        {me.role === 'admin' && <InviteCode />}
        {me.role === 'admin' && (
          <form className="card" onSubmit={sendInvite}>
            <label htmlFor="inv">
              Inviter quelqu&apos;un (son adresse e-mail)
              <input id="inv" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="emma@exemple.fr" />
            </label>
            <button className="btn flame" type="submit" disabled={busy}>{busy ? 'Invitation…' : 'Inviter'}</button>
            {result && <p className={result.ok ? 'small' : 'error'} role="status" style={{ margin: 0 }}>{result.message}</p>}
            <p className="small muted" style={{ margin: 0 }}>
              Les personnes invitées apparaissent dans le groupe dès qu&apos;elles ont rempli leur profil.
            </p>
          </form>
        )}
      </div>

      <details className="card">
        <summary><b>✨ Quoi de neuf ?</b> <span className="small muted">(mise à jour du {LATEST.date})</span></summary>
        <ul className="list" style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
          {RELEASES.flatMap(rel => rel.changes).map(c => (
            <li key={c.title} className="small">
              {c.emoji} <Link href={c.href}>{c.title}</Link> <span className="muted">· {c.where}</span>
            </li>
          ))}
        </ul>
      </details>

      <div className="block">
        <h3>Installer l&apos;app</h3>
        <div className="notice">
          <b>iPhone :</b> ouvre l&apos;app dans Safari, touche le bouton Partager puis « Sur l&apos;écran d&apos;accueil ».<br />
          <b>Android :</b> dans Chrome, menu ⋮ puis « Installer l&apos;application ».
        </div>
      </div>

      <button className="btn ghost" type="button" onClick={logout}>Me déconnecter</button>
    </section>
  );
}
