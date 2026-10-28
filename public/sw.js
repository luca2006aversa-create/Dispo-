// Service worker minimal : rend l'app installable. Les notifications push arriveront à une étape suivante.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
