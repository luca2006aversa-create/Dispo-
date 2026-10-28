import { colorVar, type Profile } from '@/lib/people';

/** Pastille ronde à l'initiale et à la couleur de la personne. */
export function Dot({ p, size = 26 }: { p?: Pick<Profile, 'first_name' | 'color'>; size?: number }) {
  return (
    <span
      className="dot"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size / 2), background: colorVar(p?.color ?? '') }}
    >
      {p?.first_name?.[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
