'use client';

import { useEffect } from 'react';

/** Retire la classe `entree` (posée par le script de tête) une fois l'animation d'entrée jouée. */
export function Entrance() {
  useEffect(() => {
    const t = setTimeout(() => document.documentElement.classList.remove('entree'), 2600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
