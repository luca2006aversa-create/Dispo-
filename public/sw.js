// Service worker : rend l'app installable et affiche les notifications push.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    // Si l'app est déjà ouverte et visible, inutile de notifier : le message s'affiche déjà.
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (open.some((c) => c.visibilityState === 'visible' && c.focused)) return;
    await self.registration.showNotification(data.title || 'Dispo ?', {
      body: data.body || '',
      icon: '/pwa-icon/192',
      badge: '/pwa-icon/192',
      tag: data.tag || 'dispo',
      renotify: true,
      data: { url: data.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of open) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(url); } catch {} }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
