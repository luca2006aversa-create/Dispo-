'use client';

import { useEffect, useState } from 'react';

/** Bouton de suppression en deux temps : un premier appui affiche « Sûr ? », le second confirme. */
export function ConfirmButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button type="button" className={`x-btn${armed ? ' armed' : ''}`}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? 'Sûr ?' : label}
    </button>
  );
}
