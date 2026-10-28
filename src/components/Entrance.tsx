'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const CLASSES = ['entree', 'entree-douce', 'entree-app'];
const DUREE_MS = { entree: 2000, 'entree-douce': 900 } as const;
const VUES = 'entree-vues';

/** Pages déjà animées depuis l'ouverture de l'app. */
function seen(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(VUES) ?? '[]')); } catch { return new Set(); }
}

/**
 * Animation d'entrée, posée avant l'affichage de la page pour éviter tout clignotement :
 * - accueil : version complète au premier passage, puis version courte et transparente à chaque retour ;
 * - autres onglets : version complète au premier passage seulement, puis plus rien.
 * « Premier passage » = depuis l'ouverture de l'app (le script de tête anime déjà le tout premier affichage).
 */
export function Entrance() {
  const path = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useLayoutEffect(() => {
    const vues = seen();
    const mode = !vues.has(path) ? 'entree' : path === '/' ? 'entree-douce' : null;
    vues.add(path);
    try { sessionStorage.setItem(VUES, JSON.stringify([...vues])); } catch {}

    const html = document.documentElement;
    if (mode) {
      html.classList.remove(mode === 'entree' ? 'entree-douce' : 'entree');
      html.classList.add(mode);
      // Les blocs agrandis pendant l'animation feraient défiler la page : on reste en haut.
      window.scrollTo(0, 0);
    }
    clearTimeout(timer.current);
    if (!mode) {
      // Onglet déjà vu : aucune animation, même si celle de la page précédente n'était pas finie.
      html.classList.remove(...CLASSES);
      return;
    }
    timer.current = setTimeout(() => {
      html.classList.remove(...CLASSES);
      window.scrollTo(0, 0);
    }, DUREE_MS[mode]);
  }, [path]);

  useLayoutEffect(() => () => clearTimeout(timer.current), []);

  return null;
}
