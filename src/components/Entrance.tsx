'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const DUREE_MS = 2000;

/**
 * Animation d'entrée : à l'ouverture de l'app (classes posées par le script de tête)
 * puis à chaque changement d'onglet. Posée avant l'affichage de la nouvelle page pour éviter tout clignotement.
 */
export function Entrance() {
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('entree');
    // Les blocs agrandis pendant l'animation feraient défiler la page : on reste en haut.
    window.scrollTo(0, 0);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      html.classList.remove('entree', 'entree-app');
      window.scrollTo(0, 0);
    }, DUREE_MS);
  }, [path]);

  useLayoutEffect(() => () => clearTimeout(timer.current), []);

  return null;
}
