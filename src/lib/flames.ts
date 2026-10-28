// Flammes : séries de jours consécutifs avec au moins une photo.

import { shiftDay } from './time';

export type FlameMember = {
  /** Jours locaux (« AAAA-MM-JJ ») où la personne a posté. */
  days: Set<string>;
  /** Date locale d'aujourd'hui pour cette personne. */
  today: string;
  /** Premier jour où la personne compte (jour où elle a rejoint le groupe). */
  since?: string;
};

export type Flame = {
  count: number;
  /** Le jour en cours n'est pas encore validé : la flamme peut encore s'éteindre. */
  pending: boolean;
};

/**
 * Série commune : nombre de dates consécutives où chaque membre déjà présent a
 * posté sur sa propre date locale.
 *
 * Une date que quelqu'un vit encore (sa date d'aujourd'hui ou plus tard) et
 * qui n'est pas encore complète est « en attente » : elle ne casse pas la
 * série, elle n'y compte juste pas encore. Avec une seule personne, c'est sa
 * flamme perso.
 */
export function flame(members: FlameMember[]): Flame {
  if (!members.length) return { count: 0, pending: false };

  const counted = (d: string) => members.filter(m => !m.since || m.since <= d);
  const complete = (d: string) => {
    const c = counted(d);
    return c.length > 0 && c.every(m => m.days.has(d));
  };
  const open = (d: string) => members.some(m => m.today <= d);

  let d = members.map(m => m.today).sort().at(-1)!;
  let pending = false;
  while (!complete(d) && open(d)) {
    pending = true;
    d = shiftDay(d, -1);
  }

  let count = 0;
  while (complete(d)) {
    count++;
    d = shiftDay(d, -1);
  }
  return { count, pending };
}
