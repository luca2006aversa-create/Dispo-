import { describe, expect, it } from 'vitest';
import { dayKey, fmtTime, nowIn, shiftDay, zonedToUtc } from './time';
import { commonSlots } from './slots';
import { flame } from './flames';

const PARIS = 'Europe/Paris';
const HANOI = 'Asia/Ho_Chi_Minh';
const H = 3_600_000;
const M = 60_000;

describe('fuseaux', () => {
  it('convertit une heure de Paris en UTC, hiver comme été', () => {
    expect(zonedToUtc('2026-01-15', '20:00', PARIS)).toBe(Date.UTC(2026, 0, 15, 19, 0));
    expect(zonedToUtc('2026-07-15', '20:00', PARIS)).toBe(Date.UTC(2026, 6, 15, 18, 0));
  });

  it("gère Hanoï (UTC+7, pas d'heure d'été)", () => {
    expect(zonedToUtc('2026-07-15', '20:00', HANOI)).toBe(Date.UTC(2026, 6, 15, 13, 0));
    expect(zonedToUtc('2026-01-15', '20:00', HANOI)).toBe(Date.UTC(2026, 0, 15, 13, 0));
  });

  it("gère le jour du passage à l'heure d'hiver (25 octobre 2026)", () => {
    expect(zonedToUtc('2026-10-25', '01:00', PARIS)).toBe(Date.UTC(2026, 9, 24, 23, 0));
    expect(zonedToUtc('2026-10-25', '12:00', PARIS)).toBe(Date.UTC(2026, 9, 25, 11, 0));
  });

  it("gère le jour du passage à l'heure d'été (29 mars 2026)", () => {
    expect(zonedToUtc('2026-03-29', '01:30', PARIS)).toBe(Date.UTC(2026, 2, 29, 0, 30));
    expect(zonedToUtc('2026-03-29', '12:00', PARIS)).toBe(Date.UTC(2026, 2, 29, 10, 0));
  });

  it('affiche la même minute dans deux fuseaux', () => {
    const ts = zonedToUtc('2026-10-28', '20:00', HANOI);
    expect(fmtTime(ts, HANOI)).toBe('20h00');
    expect(fmtTime(ts, PARIS)).toBe('14h00');
  });

  it('donne la date locale de chacun', () => {
    const ts = Date.UTC(2026, 9, 28, 20, 0); // 21h à Paris, 3h le 29 à Hanoï
    expect(dayKey(ts, PARIS)).toBe('2026-10-28');
    expect(dayKey(ts, HANOI)).toBe('2026-10-29');
  });

  it('donne le jour de la semaine local (0 = lundi)', () => {
    const ts = Date.UTC(2026, 9, 25, 22, 30); // dimanche 23h30 Paris, lundi 5h30 Hanoï
    expect(nowIn(PARIS, ts)).toEqual({ wd: 6, min: 23 * 60 + 30 });
    expect(nowIn(HANOI, ts)).toEqual({ wd: 0, min: 5 * 60 + 30 });
  });

  it('décale les dates, fins de mois comprises', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('créneaux communs', () => {
  const t0 = Date.UTC(2026, 10, 2, 17, 0);

  it('trouve le chevauchement entre deux personnes', () => {
    const s = commonSlots([
      { userId: 'gaia', start: t0, end: t0 + 2 * H },
      { userId: 'luca', start: t0 + H, end: t0 + 3 * H },
    ]);
    expect(s).toEqual([{ start: t0 + H, end: t0 + 2 * H, users: ['gaia', 'luca'] }]);
  });

  it('ignore un chevauchement de moins de 15 minutes, garde 15 pile', () => {
    expect(commonSlots([
      { userId: 'a', start: t0, end: t0 + H },
      { userId: 'b', start: t0 + H - 14 * M, end: t0 + 2 * H },
    ])).toEqual([]);
    expect(commonSlots([
      { userId: 'a', start: t0, end: t0 + H },
      { userId: 'b', start: t0 + H - 15 * M, end: t0 + 2 * H },
    ])).toHaveLength(1);
  });

  it("ne crée pas de créneau avec soi-même", () => {
    expect(commonSlots([
      { userId: 'a', start: t0, end: t0 + 2 * H },
      { userId: 'a', start: t0 + H, end: t0 + 3 * H },
    ])).toEqual([]);
  });

  it('met en avant le créneau à trois et garde les plages à deux plus longues', () => {
    const s = commonSlots([
      { userId: 'a', start: t0, end: t0 + 3 * H },
      { userId: 'b', start: t0, end: t0 + 2 * H },
      { userId: 'c', start: t0 + H, end: t0 + 3 * H },
    ]);
    expect(s).toEqual([
      { start: t0, end: t0 + 2 * H, users: ['a', 'b'] },
      { start: t0 + H, end: t0 + 2 * H, users: ['a', 'b', 'c'] },
      { start: t0 + H, end: t0 + 3 * H, users: ['a', 'c'] },
    ]);
  });

  it("ne répète pas à deux un créneau identique à celui à trois", () => {
    const s = commonSlots([
      { userId: 'a', start: t0, end: t0 + H },
      { userId: 'b', start: t0, end: t0 + H },
      { userId: 'c', start: t0, end: t0 + H },
    ]);
    expect(s).toEqual([{ start: t0, end: t0 + H, users: ['a', 'b', 'c'] }]);
  });

  it('fusionne deux dispos collées de la même personne', () => {
    const s = commonSlots([
      { userId: 'a', start: t0, end: t0 + H },
      { userId: 'a', start: t0 + H, end: t0 + 2 * H },
      { userId: 'b', start: t0, end: t0 + 2 * H },
    ]);
    expect(s).toEqual([{ start: t0, end: t0 + 2 * H, users: ['a', 'b'] }]);
  });

  it('trouve un créneau Hanoï–Toulouse saisi chacun dans son heure', () => {
    const luca = { userId: 'luca', start: zonedToUtc('2026-11-02', '20:00', HANOI), end: zonedToUtc('2026-11-02', '22:00', HANOI) };
    const gaia = { userId: 'gaia', start: zonedToUtc('2026-11-02', '15:00', PARIS), end: zonedToUtc('2026-11-02', '17:00', PARIS) };
    const [s] = commonSlots([luca, gaia]);
    expect(fmtTime(s.start, HANOI)).toBe('21h00');
    expect(fmtTime(s.start, PARIS)).toBe('15h00');
    expect(fmtTime(s.end, PARIS)).toBe('16h00');
  });
});

describe('flammes', () => {
  const days = (...d: string[]) => new Set(d);

  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    expect(flame([{ days: days('2026-10-26', '2026-10-27', '2026-10-28'), today: '2026-10-28' }]))
      .toEqual({ count: 3, pending: false });
  });

  it("reste allumée si on n'a pas encore posté aujourd'hui", () => {
    expect(flame([{ days: days('2026-10-26', '2026-10-27'), today: '2026-10-28' }]))
      .toEqual({ count: 2, pending: true });
  });

  it("s'éteint après un jour sans photo", () => {
    expect(flame([{ days: days('2026-10-25', '2026-10-26'), today: '2026-10-28' }]))
      .toEqual({ count: 0, pending: true });
  });

  it('flamme du groupe : seulement les jours où tout le monde a posté', () => {
    const f = flame([
      { days: days('2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'), today: '2026-10-28' },
      { days: days('2026-10-26', '2026-10-27', '2026-10-28'), today: '2026-10-28' },
    ]);
    expect(f).toEqual({ count: 3, pending: false });
  });

  it("n'éteint pas la flamme du groupe parce que Hanoï est déjà le lendemain", () => {
    const f = flame([
      { days: days('2026-10-27', '2026-10-28'), today: '2026-10-28' }, // Gaïa, 21h
      { days: days('2026-10-27', '2026-10-28'), today: '2026-10-29' }, // Luca, 3h du matin
    ]);
    expect(f).toEqual({ count: 2, pending: true });
  });

  it("attend Gaïa qui n'a pas encore posté aujourd'hui", () => {
    const f = flame([
      { days: days('2026-10-27'), today: '2026-10-28' },
      { days: days('2026-10-27', '2026-10-28'), today: '2026-10-28' },
    ]);
    expect(f).toEqual({ count: 1, pending: true });
  });

  it("ne compte un nouveau membre qu'à partir de son arrivée", () => {
    const f = flame([
      { days: days('2026-10-26', '2026-10-27', '2026-10-28'), today: '2026-10-28' },
      { days: days('2026-10-28'), today: '2026-10-28', since: '2026-10-28' },
    ]);
    expect(f).toEqual({ count: 3, pending: false });
  });

  it('vaut zéro sans aucune photo', () => {
    expect(flame([{ days: days(), today: '2026-10-28' }])).toEqual({ count: 0, pending: true });
    expect(flame([])).toEqual({ count: 0, pending: false });
  });
});
