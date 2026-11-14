// Service worker: recebe as notificações push e abre o app no lugar certo ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Pesquisa Seguro Auto", {
    body: d.body || "", icon: "/icon-192.png", badge: "/favicon-32.png",
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) {
      if (new URL(c.url).origin === self.location.origin) {
        c.postMessage({ tipo: "abrir", url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
