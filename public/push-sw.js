/* Web Push handlers, imported into the generated Workbox service worker via
   vite-plugin-pwa's workbox.importScripts. Kept out of the app bundle because a
   service worker is a separate script with its own globals (self, clients).

   Sender payload: { title, body, url, tag }. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_e) { data = { title: "BoredGame", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "BoredGame";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    tag: data.tag || "boredgame",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      // Reuse an open tab: focus it and route, instead of opening a duplicate.
      if ("focus" in c) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(url); } catch (_e) { /* cross-origin or blocked */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
