// Offline: eerst netwerk (altijd nieuwste versie), cache als terugval.
const CACHE = "loopcoach-v3";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "index.html", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "data/schema.json"])));
  self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const url = e.request.url;
  // Eigen bestanden + de supabase-js bibliotheek (vaste versie) offline beschikbaar; API-verkeer nooit cachen.
  if (e.request.method !== "GET" || !(new URL(url).origin === location.origin || url.startsWith("https://cdn.jsdelivr.net/npm/@supabase/"))) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy))); }
        return r;
      })
      .catch(async () => (await caches.match(e.request, { ignoreSearch: true }))
        || (e.request.mode === "navigate" ? caches.match("./") : Response.error()))
  );
});
