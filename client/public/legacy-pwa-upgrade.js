// Pre-update-prompt clients kept their installed shell open and could never accept a waiting worker.
// Their cached manifest predates the explicit app ID. Activate once for those clients so their
// existing auto-update handler can reload. Current clients still confirm ordinary updates.
self.addEventListener("install", event => {
  if (!self.registration.active) return;

  const manifestUrl = new URL("manifest.webmanifest", self.registration.scope);
  event.waitUntil((async () => {
    const cached = await caches.match(manifestUrl, { ignoreSearch: true });
    if (!cached) return;
    const manifest = await cached.json();
    if (manifest?.display === "standalone" && !manifest.id) await self.skipWaiting();
  })().catch(() => {}));
});
