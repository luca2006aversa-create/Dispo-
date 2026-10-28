import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Caveat } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'], weight: ['400', '600', '800'] });
const caveat = Caveat({ variable: '--font-caveat', subsets: ['latin'], weight: ['500', '700'] });

export const metadata: Metadata = {
  title: 'Dispo ?',
  description: 'Le QG de Gaïa, Emma, Luca et compagnie : dispos, photos, flammes et projets.',
  applicationName: 'Dispo ?',
  appleWebApp: { capable: true, title: 'Dispo ?', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF2F7' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1420' },
  ],
};

// Applique le thème choisi (clair / sombre / auto) avant le premier affichage.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
