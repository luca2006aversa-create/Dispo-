// Détection des créneaux communs entre les dispos de plusieurs personnes.

export type Availability = { userId: string; start: number; end: number };
export type Slot = { start: number; end: number; users: string[] };

export const MIN_OVERLAP_MS = 15 * 60_000;

/**
 * Renvoie les créneaux où au moins deux personnes sont libres en même temps
 * pendant au moins `minMs`.
 *
 * Pour chaque groupe de personnes qui se retrouve libre ensemble, on garde les
 * plages maximales où elles le sont toutes. Un créneau est retiré s'il existe
 * exactement la même plage avec plus de monde. Tri : par début, puis les
 * créneaux à plus de personnes d'abord.
 */
export function commonSlots(avails: Availability[], minMs = MIN_OVERLAP_MS): Slot[] {
  const valid = avails.filter(a => a.end > a.start);
  const bounds = [...new Set(valid.flatMap(a => [a.start, a.end]))].sort((a, b) => a - b);

  // Segments élémentaires et qui y est libre.
  const segs: { start: number; end: number; who: Set<string> }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i], e = bounds[i + 1];
    const who = new Set(valid.filter(a => a.start <= s && a.end >= e).map(a => a.userId));
    if (who.size >= 2) segs.push({ start: s, end: e, who });
  }

  const groups = new Map<string, string[]>();
  for (const seg of segs) {
    const users = [...seg.who].sort();
    groups.set(users.join('|'), users);
  }

  const found: Slot[] = [];
  for (const users of groups.values()) {
    let run: Slot | null = null;
    for (const seg of segs) {
      const all = users.every(u => seg.who.has(u));
      if (all && run && run.end === seg.start) run.end = seg.end;
      else if (all) {
        if (run) found.push(run);
        run = { start: seg.start, end: seg.end, users };
      } else if (run) {
        found.push(run);
        run = null;
      }
    }
    if (run) found.push(run);
  }

  return found
    .filter(sl => sl.end - sl.start >= minMs)
    .filter((sl, _, all) => !all.some(o =>
      o !== sl && o.start === sl.start && o.end === sl.end &&
      o.users.length > sl.users.length && sl.users.every(u => o.users.includes(u))))
    .sort((a, b) => a.start - b.start || b.users.length - a.users.length);
}
