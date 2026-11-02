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
