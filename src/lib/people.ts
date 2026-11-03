// Profils et couleurs des personnes.

export type Profile = {
  id: string;
  first_name: string;
  color: string;
  city: string;
  timezone: string;
  /** Photo de profil dans le stockage, si la personne en a mis une. */
  avatar_path?: string | null;
  /** Position de sa ville (arrondie), pour le globe. */
  lat?: number | null;
  lon?: number | null;
  /** La personne partage la position de son téléphone (sinon : celle de sa ville). */
  location_live?: boolean;
  /** Dernière mise à jour de la position en direct. */
  location_at?: string | null;
};

export type Member = Profile & { role: 'admin' | 'member'; joined_at: string };

export const COLORS: { key: string; label: string }[] = [
  { key: 'bleu', label: 'Bleu' },
  { key: 'rose', label: 'Rose' },
  { key: 'vert', label: 'Vert' },
  { key: 'violet', label: 'Violet' },
  { key: 'corail', label: 'Corail' },
  { key: 'turquoise', label: 'Turquoise' },
  { key: 'ambre', label: 'Ambre' },
  { key: 'rouge', label: 'Rouge' },
];

/** Couleurs en clair, au format [r, g, b] entre 0 et 1, pour le globe (WebGL ne lit pas les variables CSS). */
const RGB: Record<string, string> = {
  bleu: '#2F6BFF', rose: '#E0347F', vert: '#12866A', violet: '#8A4FE0',
  corail: '#E8552B', turquoise: '#0E8A9E', ambre: '#B7791F', rouge: '#C81E3A',
};
export const colorRgb = (key: string): [number, number, number] => {
  const hex = RGB[key] ?? RGB.bleu;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
};

export const colorVar = (key: string) =>
  `var(--p-${COLORS.some(c => c.key === key) ? key : 'bleu'})`;

/** « Gaïa » → « gaia », pour comparer des prénoms. */
export const plain = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
