import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dispo ?',
    short_name: 'Dispo ?',
    description: 'Dispos, photos, flammes et projets entre proches qui vivent loin.',
    lang: 'fr',
    start_url: '/',
    display: 'standalone',
    background_color: '#EEF2F7',
    theme_color: '#EEF2F7',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
