// Dates des projets de vacances.

export const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

/** « du 12 juil. 2027 au 26 juil. 2027 », « à partir du … », « dates à fixer » */
export function projectDates(p: { starts_on: string | null; ends_on: string | null }) {
  if (p.starts_on && p.ends_on) return `du ${fmtDate(p.starts_on)} au ${fmtDate(p.ends_on)}`;
  if (p.starts_on) return `à partir du ${fmtDate(p.starts_on)}`;
  return 'dates à fixer';
}

/** Jours avant le départ (négatif une fois parti), ou null sans date. */
export function daysUntil(start: string | null, today: string) {
  if (!start) return null;
  return Math.round((Date.parse(start + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86_400_000);
}
