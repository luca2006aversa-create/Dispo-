// Profils et couleurs des personnes.

export type Profile = {
  id: string;
  first_name: string;
  color: string;
  city: string;
  timezone: string;
  /** Photo de profil dans le stockage, si la personne en a mis une. */
  avatar_path?: string | null;
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

export const colorVar = (key: string) =>
  `var(--p-${COLORS.some(c => c.key === key) ? key : 'bleu'})`;

/** « Gaïa » → « gaia », pour comparer des prénoms. */
export const plain = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
