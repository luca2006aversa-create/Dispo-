'use client';

import { useEffect } from 'react';

/** Retire la classe `entree` (posée par le script de tête) une fois l'animation d'entrée jouée. */
export function Entrance() {
  useEffect(() => {
    // Les blocs agrandis pendant l'animation font défiler la page : on revient en haut au début et à la fin.
    window.scrollTo(0, 0);
    const t = setTimeout(() => {
      document.documentElement.classList.remove('entree');
      window.scrollTo(0, 0);
    }, 2600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
