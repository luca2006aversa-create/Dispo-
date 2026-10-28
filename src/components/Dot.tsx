'use client';

import { colorVar, type Profile } from '@/lib/people';
import { useAvatar, useZoomAvatar } from './AppProvider';

/**
 * Pastille ronde : la photo de profil si la personne en a mis une, sinon l'initiale sur sa couleur.
 * Avec `zoom`, toucher la photo l'affiche en grand.
 */
export function Dot({ p, size = 26, zoom }: {
  p?: Pick<Profile, 'first_name' | 'color'> & { id?: string }; size?: number; zoom?: boolean;
}) {
  const url = useAvatar(p?.id);
  const zoomAvatar = useZoomAvatar();
  const style = { width: size, height: size, fontSize: Math.round(size / 2), background: colorVar(p?.color ?? '') };
  if (url && zoom && zoomAvatar && p?.id) {
    const id = p.id;
    return (
      <button type="button" className="dot dot-zoom" style={style} onClick={() => zoomAvatar(id)}
        aria-label={`Voir la photo de ${p.first_name} en grand`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" />
      </button>
    );
  }
  return (
    <span className="dot" aria-hidden="true" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : p?.first_name?.[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
