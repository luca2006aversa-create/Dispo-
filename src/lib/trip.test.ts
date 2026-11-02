import { describe, expect, it } from 'vitest';
import { budget, fairest, mondayOf, parseEuros, travel, weekAvailability, weeksBetween } from './trip';
import type { LatLon } from './geo';

describe('semaines', () => {
  it('trouve le lundi de la semaine', () => {
    expect(mondayOf('2027-07-14')).toBe('2027-07-12'); // mercredi
    expect(mondayOf('2027-07-12')).toBe('2027-07-12'); // lundi
    expect(mondayOf('2027-07-18')).toBe('2027-07-12'); // dimanche
  });

  it("liste les semaines d'une période", () => {
    expect(weeksBetween('2027-07-14', '2027-08-02')).toEqual(['2027-07-12', '2027-07-19', '2027-07-26', '2027-08-02']);
    expect(weeksBetween('2027-01-01', '2028-12-31', 3)).toHaveLength(3);
  });

  it('repère les semaines où tout le monde est libre', () => {
    const free = { a: new Set(['w1', 'w2']), b: new Set(['w2']), c: new Set(['w2', 'w3']) };
    expect(weekAvailability(['w1', 'w2', 'w3'], free, ['a', 'b', 'c'])).toEqual([
      { week: 'w1', who: ['a'], all: false },
      { week: 'w2', who: ['a', 'b', 'c'], all: true },
      { week: 'w3', who: ['c'], all: false },
    ]);
  });
});

describe('lieu le plus juste', () => {
  const TOULOUSE: LatLon = [43.6, 1.44], NANTES: LatLon = [47.22, -1.55], HANOI: LatLon = [21.03, 105.85];
  const people = [{ id: 'gaia', at: TOULOUSE }, { id: 'emma', at: NANTES }, { id: 'luca', at: HANOI }];

  it('donne le trajet le plus long et sa personne', () => {
    const t = travel(TOULOUSE, people);
    expect(t.longest.id).toBe('luca');
    expect(t.total).toBeGreaterThan(t.longest.km);
  });

  it('préfère le lieu où le plus long trajet est le plus court', () => {
    const BIARRITZ: LatLon = [43.48, -1.56], BANGKOK: LatLon = [13.75, 100.5], DUBAI: LatLon = [25.2, 55.27];
    // À Dubaï, personne ne fait l'énorme trajet de Luca vers Biarritz ni celui de Gaïa et Emma vers Bangkok.
    expect(fairest([BIARRITZ, BANGKOK, DUBAI], people)).toBe(2);
  });

  it('ignore les lieux sans position', () => {
    expect(fairest([null, [43.48, -1.56]], people)).toBe(1);
    expect(fairest([null], people)).toBe(-1);
  });
});

describe('budget', () => {
  it('partage les dépenses communes et compte le transport perso dans le coût', () => {
    const r = budget([
      { paidBy: 'gaia', cents: 30000, shared: true }, // location : 300 €
      { paidBy: 'luca', cents: 90000, shared: false }, // avion de Luca : 900 €
    ], ['gaia', 'emma', 'luca']);
    expect(r.cost).toEqual({ gaia: 10000, emma: 10000, luca: 100000 });
    expect(r.balance).toEqual({ gaia: 20000, emma: -10000, luca: -10000 });
    expect(r.transfers).toEqual([
      { from: 'emma', to: 'gaia', cents: 10000 },
      { from: 'luca', to: 'gaia', cents: 10000 },
    ]);
  });

  it('ne perd pas de centimes quand ça ne tombe pas juste', () => {
    const r = budget([{ paidBy: 'a', cents: 1000, shared: true }], ['a', 'b', 'c']);
    expect(Object.values(r.cost).reduce((s, x) => s + x, 0)).toBe(1000);
    expect(Object.values(r.balance).reduce((s, x) => s + x, 0)).toBe(0);
    expect(r.transfers.reduce((s, t) => s + t.cents, 0)).toBe(666);
  });

  it('ne demande aucun virement quand tout est équilibré', () => {
    const r = budget([{ paidBy: 'a', cents: 500, shared: true }, { paidBy: 'b', cents: 500, shared: true }], ['a', 'b']);
    expect(r.transfers).toEqual([]);
  });
});

describe('montants', () => {
  it('lit les montants écrits à la française', () => {
    expect(parseEuros('12,5')).toBe(1250);
    expect(parseEuros('1 200 €')).toBe(120000);
    expect(parseEuros('0')).toBeNull();
    expect(parseEuros('abc')).toBeNull();
    expect(parseEuros('3,999')).toBeNull();
  });
});
