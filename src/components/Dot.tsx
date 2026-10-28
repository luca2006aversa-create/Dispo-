'use client';

import { colorVar, type Profile } from '@/lib/people';
import { useAvatar } from './AppProvider';

/** Pastille ronde : la photo de profil si la personne en a mis une, sinon l'initiale sur sa couleur. */
export function Dot({ p, size = 26 }: { p?: Pick<Profile, 'first_name' | 'color'> & { id?: string }; size?: number }) {
  const url = useAvatar(p?.id);
  return (
    <span
      className="dot"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size / 2), background: colorVar(p?.color ?? '') }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : p?.first_name?.[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
