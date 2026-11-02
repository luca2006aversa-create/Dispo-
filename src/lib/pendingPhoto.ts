// Photo prise depuis l'accueil (bouton caméra du défi) et transmise à la page Photos
// pendant la navigation. Reste en mémoire : elle disparaît si on recharge la page.

let pending: Blob | null = null;

export const setPendingPhoto = (b: Blob | null) => { pending = b; };
export const peekPendingPhoto = () => pending;
