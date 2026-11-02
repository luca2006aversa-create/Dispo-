// Nouveautés affichées une fois à l'ouverture de l'app (fenêtre « Quoi de neuf ? »).
// Pour une nouvelle mise à jour : ajouter une entrée EN HAUT avec un nouvel `id`.

export type Change = { emoji: string; title: string; where: string; href: string };
export type Release = { id: string; date: string; changes: Change[] };

export const RELEASES: Release[] = [
  {
    id: '2026-11-02',
    date: '2 novembre',
    changes: [
      { emoji: '🏖️', title: 'Projets de vacances : lieux, semaines libres, budget, sondages et album', where: 'Onglet Projets', href: '/projets' },
      { emoji: '⚖️', title: 'Le lieu le plus juste pour tous, selon la ville de chacun', where: 'Projets › Lieux', href: '/projets' },
      { emoji: '⏳', title: 'Compte à rebours du prochain voyage et défi spécial départ', where: 'Accueil', href: '/' },
      { emoji: '💬', title: 'Le chat du groupe, avec les messages non lus', where: 'Onglet Chat', href: '/chat' },
      { emoji: '📷', title: "« Je relève le défi » ouvre directement l'appareil photo", where: 'Accueil › Défi du jour', href: '/' },
      { emoji: '🌍', title: 'Le globe : où est chacun, les distances et l’heure chez les autres', where: 'Accueil › Où est tout le monde ?', href: '/globe' },
      { emoji: '🖼️', title: 'Une photo de profil, à agrandir en la touchant', where: 'Réglages (ta pastille en haut à droite)', href: '/reglages' },
    ],
  },
];

export const LATEST = RELEASES[0];
