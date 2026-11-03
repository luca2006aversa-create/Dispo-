import { describe, expect, it } from 'vitest';
import { distanceKm, fmtKm, type LatLon } from './geo';

const TOULOUSE: LatLon = [43.6, 1.44];
const PARIS: LatLon = [48.85, 2.35];
const HANOI: LatLon = [21.03, 105.85];

describe('distances', () => {
  it('Paris – Toulouse : environ 590 km', () => {
    expect(distanceKm(PARIS, TOULOUSE)).toBeGreaterThan(580);
    expect(distanceKm(PARIS, TOULOUSE)).toBeLessThan(600);
  });

  it('Toulouse – Hanoï : environ 9 500 km ; Paris – Hanoï : environ 9 200 km', () => {
    expect(distanceKm(TOULOUSE, HANOI)).toBeGreaterThan(9400);
    expect(distanceKm(TOULOUSE, HANOI)).toBeLessThan(9600);
    expect(distanceKm(PARIS, HANOI)).toBeGreaterThan(9100);
    expect(distanceKm(PARIS, HANOI)).toBeLessThan(9300);
  });

  it('donne le même résultat que la loi des cosinus sphérique', () => {
    const r = (d: number) => (d * Math.PI) / 180;
    const cosines = (a: LatLon, b: LatLon) => 6371 * Math.acos(
      Math.sin(r(a[0])) * Math.sin(r(b[0])) + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.cos(r(b[1] - a[1])),
    );
    for (const [a, b] of [[PARIS, HANOI], [TOULOUSE, HANOI], [PARIS, TOULOUSE]] as const) {
      expect(distanceKm(a, b)).toBeCloseTo(cosines(a, b), 3);
    }
  });

  it('est symétrique et nulle entre un point et lui-même', () => {
    expect(distanceKm(PARIS, HANOI)).toBeCloseTo(distanceKm(HANOI, PARIS), 6);
    expect(distanceKm(PARIS, PARIS)).toBe(0);
  });

  it('traverse correctement la ligne de changement de date', () => {
    expect(distanceKm([0, 179], [0, -179])).toBeCloseTo(222.4, 0);
  });

  it('formate les distances en français', () => {
    expect(fmtKm(3.44)).toBe('3,4 km');
    expect(fmtKm(588.2)).toBe('588 km');
    expect(fmtKm(9873.4).replace(/\s/g, ' ')).toBe('9 873 km');
  });
});

describe('âge d’une position', () => {
  it('dit depuis quand la position date', async () => {
    const { fmtAgo } = await import('./time');
    const now = Date.UTC(2026, 10, 3, 12, 0);
    expect(fmtAgo(now - 20_000, now)).toBe("à l'instant");
    expect(fmtAgo(now - 5 * 60_000, now)).toBe('il y a 5 min');
    expect(fmtAgo(now - 125 * 60_000, now)).toBe('il y a 2 h');
    expect(fmtAgo(now - 3 * 86_400_000, now)).toBe('il y a 3 j');
  });
});

describe('arcs de grand cercle', () => {
  it('part du premier point et arrive au second', async () => {
    const { greatCircle } = await import('./geo');
    const pts = greatCircle([43.6, 1.44], [21.03, 105.85], 32);
    expect(pts).toHaveLength(33);
    expect(pts[0][0]).toBeCloseTo(1.44, 6);
    expect(pts[0][1]).toBeCloseTo(43.6, 6);
    expect(pts[32][0]).toBeCloseTo(105.85, 6);
    expect(pts[32][1]).toBeCloseTo(21.03, 6);
  });

  it("passe par le milieu sur l'équateur", async () => {
    const { greatCircle } = await import('./geo');
    const mid = greatCircle([0, 0], [0, 90], 2)[1];
    expect(mid[0]).toBeCloseTo(45, 6);
    expect(mid[1]).toBeCloseTo(0, 6);
  });

  it('ne fait pas le tour du monde en traversant la ligne de changement de date', async () => {
    const { greatCircle } = await import('./geo');
    const pts = greatCircle([0, 170], [0, -170], 4);
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0])).toBeLessThan(10);
    expect(pts[4][0]).toBeCloseTo(190, 6);
  });
});
