'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { removeSubscription, saveSubscription } from '@/app/(app)/reglages/pushActions';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const DISMISSED = 'notif-refusee';

type State = 'checking' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** État des notifications sur ce téléphone + actions pour les activer / désactiver. */
function useNotifications() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: State;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !PUBLIC_KEY) {
        // Sur iPhone, les notifications n'existent que dans l'app installée sur l'écran d'accueil.
        next = isIos() && !isInstalled() ? 'needs-install' : 'unsupported';
      } else if (Notification.permission === 'denied') next = 'denied';
      else if (Notification.permission === 'granted') {
        const sub = await currentSubscription();
        if (sub) {
          // On remet l'abonnement à jour côté serveur (il peut avoir changé).
          const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
          saveSubscription(j).catch(() => {});
        }
        next = sub ? 'on' : 'off';
      } else next = 'off';
      if (alive) setState(next);
    })().catch(() => alive && setState('unsupported'));
    return () => { alive = false; };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return false; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      const res = await saveSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      if (!res.ok) return false;
      setState('on');
      try { localStorage.removeItem(DISMISSED); } catch {}
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) { await removeSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, enable, disable };
}

const HELP: Partial<Record<State, string>> = {
  unsupported: "Ce navigateur ne gère pas les notifications. Sur iPhone, ajoute d'abord l'app à l'écran d'accueil.",
  'needs-install': "Sur iPhone, ajoute d'abord l'app à ton écran d'accueil (Partager › Sur l'écran d'accueil), ouvre-la depuis l'icône, puis reviens ici.",
  denied: "Les notifications sont bloquées pour l'app. Autorise-les dans les réglages du téléphone (Notifications › Dispo ?), puis reviens ici.",
};

/** Interrupteur dans les Réglages. */
export function NotificationToggle() {
  const { state, busy, enable, disable } = useNotifications();
  const { toast } = useApp();
  if (state === 'checking') return null;
  const on = state === 'on';
  const can = state === 'on' || state === 'off';
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <b>🔔 Notifications</b>
        {can && (
          <button type="button" role="switch" aria-checked={on} className={`switch${on ? ' on' : ''}`} disabled={busy}
            aria-label="Notifications"
            onClick={async () => {
              if (on) await disable();
              else if (!(await enable())) toast("Les notifications n'ont pas pu être activées.");
            }} />
        )}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {can ? 'Reçois une alerte sur ton téléphone quand quelqu’un écrit dans le chat.' : HELP[state]}
      </p>
    </div>
  );
}

/** Bandeau sur l'accueil, tant que les notifications ne sont pas activées (un bouton : l'autorisation demande un geste). */
export function NotificationPrompt() {
  const { state, busy, enable } = useNotifications();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISSED) === '1'; } catch { return false; }
  });
  if (state !== 'off' || hidden) return null;
  return (
    <div className="card" role="region" aria-label="Notifications">
      <b>🔔 Être prévenu·e des nouveaux messages ?</b>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>
        Active les notifications : tu verras une alerte sur ton téléphone quand quelqu’un écrit dans le chat.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn flame sm" type="button" disabled={busy} onClick={() => { enable(); }}>
          {busy ? 'Activation…' : 'Activer les notifications'}
        </button>
        <button className="btn ghost sm" type="button"
          onClick={() => { setHidden(true); try { localStorage.setItem(DISMISSED, '1'); } catch {} }}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
