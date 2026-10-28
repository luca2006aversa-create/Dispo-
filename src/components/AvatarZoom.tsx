'use client';

import { useEffect, useRef } from 'react';
import type { Member } from '@/lib/people';

/** Photo de profil en grand, par-dessus l'app. Se ferme d'un toucher, avec Échap ou le bouton. */
export function AvatarZoom({ url, person, onClose }: { url: string; person?: Member; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="zoom" onClose={onClose} onClick={() => dialog.current?.close()}
      aria-label={person ? `Photo de ${person.first_name}` : 'Photo de profil'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={person ? `Photo de profil de ${person.first_name}` : 'Photo de profil'} />
      {person && <p><b>{person.first_name}</b>{person.city ? ` · ${person.city}` : ''}</p>}
      <button className="btn ghost" type="button" autoFocus>Fermer</button>
    </dialog>
  );
}
