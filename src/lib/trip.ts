// Projets de vacances : semaines communes, lieu le plus juste, budget et remboursements.

import { distanceKm, type LatLon } from './geo';
import { shiftDay } from './time';

/** Lundi de la semaine qui contient la date « AAAA-MM-JJ ». */
export function mondayOf(day: string): string {
  const wd = (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = lundi
  return shiftDay(day, -wd);
}

/** Lundis des semaines entre deux dates (incluses), au plus `max` semaines. */
export function weeksBetween(from: string, to: string, max = 40): string[] {
  const out: string[] = [];
  for (let w = mondayOf(from); w <= to && out.length < max; w = shiftDay(w, 7)) out.push(w);
  return out;
}

/** Pour chaque semaine : qui est libre, et si tout le monde l'est. */
export function weekAvailability(weeks: string[], free: Record<string, Set<string>>, memberIds: string[]) {
  return weeks.map(week => {
    const who = memberIds.filter(id => free[id]?.has(week));
    return { week, who, all: memberIds.length > 0 && who.length === memberIds.length };
  });
}

export type Point = { id: string; at: LatLon };

/** Le trajet le plus long (et sa personne) pour rejoindre un lieu, et le total des trajets. */
export function travel(place: LatLon, people: Point[]) {
  let longest = { id: '', km: 0 };
  let total = 0;
  for (const p of people) {
    const km = distanceKm(p.at, place);
    total += km;
    if (km > longest.km) longest = { id: p.id, km };
  }
  return { longest, total };
}

/** Index du lieu le plus juste : celui dont le trajet le plus long est le plus court (puis le total). */
export function fairest(places: (LatLon | null)[], people: Point[]): number {
  let best = -1;
  let score: [number, number] = [Infinity, Infinity];
  places.forEach((pl, i) => {
    if (!pl || !people.length) return;
    const t = travel(pl, people);
    if (t.longest.km < score[0] || (t.longest.km === score[0] && t.total < score[1])) {
      best = i;
      score = [t.longest.km, t.total];
    }
  });
  return best;
}

export type Expense = { paidBy: string; cents: number; shared: boolean };

/**
 * Budget : coût par personne (sa part des dépenses partagées + ses dépenses perso, transport compris),
 * solde de chacun sur les dépenses partagées, et les virements qui remettent tout le monde à zéro.
 * Les centimes qui ne se divisent pas sont répartis sur les premières personnes.
 */
export function budget(expenses: Expense[], memberIds: string[]) {
  const n = memberIds.length;
  const cost: Record<string, number> = {};
  const balance: Record<string, number> = {};
  for (const id of memberIds) { cost[id] = 0; balance[id] = 0; }

  for (const e of expenses) {
    if (!e.shared) {
      if (e.paidBy in cost) cost[e.paidBy] += e.cents;
      continue;
    }
    if (!n) continue;
    const base = Math.floor(e.cents / n);
    memberIds.forEach((id, i) => {
      const share = base + (i < e.cents - base * n ? 1 : 0);
      cost[id] += share;
      balance[id] -= share;
    });
    if (e.paidBy in balance) balance[e.paidBy] += e.cents;
  }

  // Virements : celui qui doit le plus paie celui à qui on doit le plus, jusqu'à zéro.
  const debtors = memberIds.filter(id => balance[id] < 0).map(id => ({ id, left: -balance[id] }));
  const creditors = memberIds.filter(id => balance[id] > 0).map(id => ({ id, left: balance[id] }));
  debtors.sort((a, b) => b.left - a.left);
  creditors.sort((a, b) => b.left - a.left);
  const transfers: { from: string; to: string; cents: number }[] = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const cents = Math.min(debtors[d].left, creditors[c].left);
    if (cents > 0) transfers.push({ from: debtors[d].id, to: creditors[c].id, cents });
    debtors[d].left -= cents;
    creditors[c].left -= cents;
    if (!debtors[d].left) d++;
    if (!creditors[c].left) c++;
  }
  return { cost, balance, transfers };
}

/** « 12,50 € » */
export const fmtEuros = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** « 12,5 », « 12.50 », « 1 200 € » → centimes (ou null si ce n'est pas un montant). */
export function parseEuros(input: string): number | null {
  const clean = input.replace(/[\s €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 ? cents : null;
}
