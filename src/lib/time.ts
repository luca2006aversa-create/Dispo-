// Fuseaux horaires : tout est stocké en UTC (millisecondes), affiché dans le fuseau de chacun.

export const DAY_MS = 86_400_000;

const dtf = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, make: () => Intl.DateTimeFormat) {
  let f = dtf.get(key);
  if (!f) dtf.set(key, (f = make()));
  return f;
}

function parts(ts: number, tz: string) {
  const f = fmt('p' + tz, () => new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }));
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return o;
}

/** Date locale « AAAA-MM-JJ » de l'instant `ts` dans le fuseau `tz`. */
export function dayKey(ts: number, tz: string): string {
  const p = parts(ts, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Décalage du fuseau par rapport à UTC à l'instant `ts`, en ms (Paris l'hiver : +3 600 000). */
export function tzOffset(ts: number, tz: string): number {
  const p = parts(ts, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Convertit une heure murale (« 2026-10-28 », « 20:00 ») vue dans `tz` en instant UTC. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  let ts = wall - tzOffset(wall, tz);
  const second = wall - tzOffset(ts, tz);
  // Autour d'un changement d'heure, le second essai corrige le décalage.
  if (second !== ts) ts = second;
  return ts;
}

/** Jour de la semaine (0 = lundi) et minutes depuis minuit, dans `tz`. */
export function nowIn(tz: string, ts = Date.now()) {
  const p = parts(ts, tz);
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return { wd, min: +p.hour * 60 + +p.minute };
}

/** Décale une date « AAAA-MM-JJ » de `n` jours. */
export function shiftDay(key: string, n: number): string {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** « 20h05 » */
export function fmtTime(ts: number, tz: string): string {
  const p = parts(ts, tz);
  return `${p.hour}h${p.minute}`;
}

/** « aujourd'hui », « demain », « hier » ou « mardi 3 nov. » */
export function fmtDay(ts: number, tz: string, now = Date.now()): string {
  const k = dayKey(ts, tz), today = dayKey(now, tz);
  if (k === today) return "aujourd'hui";
  if (k === shiftDay(today, 1)) return 'demain';
  if (k === shiftDay(today, -1)) return 'hier';
  return fmt('d' + tz, () => new Intl.DateTimeFormat('fr-FR', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'short',
  })).format(new Date(ts));
}

/** Fuseau détecté par le navigateur. */
export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}
