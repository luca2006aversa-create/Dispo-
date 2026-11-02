'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LATEST } from '@/lib/changelog';

const SEEN = 'nouveautes-vues';

/** « Quoi de neuf ? » : une fois par mise à jour, juste après l'animation d'entrée. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN); } catch {}
    if (seen === LATEST.id) return;
    const t = setTimeout(() => setOpen(true), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  function close() {
    try { localStorage.setItem(SEEN, LATEST.id); } catch {}
    dialog.current?.close();
    setOpen(false);
  }

  if (!open) return null;
  return (
    <dialog ref={dialog} className="news" onClose={close} aria-labelledby="news-title">
      <h2 id="news-title">✨ Quoi de neuf ?</h2>
      <p className="small muted" style={{ margin: 0 }}>Mise à jour du {LATEST.date}. Touche une ligne pour y aller.</p>
      <ul>
        {LATEST.changes.map(c => (
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
