'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LATEST, RELEASES, type Release } from '@/lib/changelog';

const SEEN = 'nouveautes-vues';

/** « Quoi de neuf ? » : une fois par mise à jour, juste après l'animation d'entrée. */
export function WhatsNew() {
  // Toutes les mises à jour pas encore vues (la plus récente en premier).
  const [unseen, setUnseen] = useState<Release[]>([]);
  const open = unseen.length > 0;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN); } catch {}
    const fresh = RELEASES.filter(r => !seen || r.id > seen);
    if (!fresh.length) return;
    const t = setTimeout(() => setUnseen(fresh), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  function close() {
    try { localStorage.setItem(SEEN, LATEST.id); } catch {}
    dialog.current?.close();
    setUnseen([]);
  }

  if (!open) return null;
  return (
    <dialog ref={dialog} className="news" onClose={close} aria-labelledby="news-title">
      <h2 id="news-title">✨ Quoi de neuf ?</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Mise{unseen.length > 1 ? 's' : ''} à jour du {unseen.map(r => r.date).join(' et du ')}. Touche une ligne pour y aller.
      </p>
      <ul>
        {unseen.flatMap(r => r.changes).map(c => (
          <li key={c.title}>
            <Link href={c.href} onClick={close}>
              <span className="e" aria-hidden="true">{c.emoji}</span>
              <span><b>{c.title}</b><br /><span className="small muted">{c.where}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <button className="btn flame" type="button" onClick={close} autoFocus>Super, merci !</button>
    </dialog>
  );
}
