'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const TABS = [
  { href: '/', label: 'Accueil', icon: <svg {...svg}><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" /></svg> },
  { href: '/dispos', label: 'Dispos', icon: <svg {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> },
  { href: '/planning', label: 'Planning', icon: <svg {...svg}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg> },
  { href: '/photos', label: 'Photos', icon: <svg {...svg}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg> },
  { href: '/projets', label: 'Projets', icon: <svg {...svg}><path d="M3 20l6-11 4 6 3-4 5 9z" /><circle cx="17" cy="6" r="2" /></svg> },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Sections">
      <div className="in">
        {TABS.map(t => {
          const active = t.href === '/' ? path === '/' : path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
