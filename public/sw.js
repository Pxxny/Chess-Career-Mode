/* Offline support: the app shell and every same-origin file it loads are cached as you play. */
const VERSION = "v38-startup-recovery";
const CACHE = `chess-career-${VERSION}`;
const SHELL = [
  "/data/game-atlas.json", "/data/venue-cities.json",
  "/news/trophy.svg", "/news/national.svg", "/news/title.svg", "/news/qualification.svg",
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/audio/chess/move-1.wav",
  "/audio/chess/move-2.wav",
  "/audio/chess/move-3.wav",
  "/audio/chess/capture.wav",
  "/audio/career/milestone.wav",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map(path => cache.add(new Request(path, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("chess-career-v") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Recovery must work independently of any cached application HTML.
  if (url.pathname === "/recovery.html") return;
  if (request.mode === "navigate") {
    // Pages: the network first so updates arrive, the cached shell when offline.
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
    return;
  }
  // Vite's hashed modules must never be replaced by an SPA HTML fallback.
  if (url.pathname.startsWith("/assets/") && /\.m?js$/.test(url.pathname)) {
    event.respondWith((async () => {
      const isModule = response => response?.ok &&
        /(?:java|ecma)script/i.test(response.headers.get("content-type") ?? "");
      const cached = await caches.match(request);
      if (isModule(cached)) return cached;
      const response = await fetch(request, { cache: "no-cache" });
      if (!isModule(response)) return Response.error();
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      return response;
    })());
    return;
  }
  // Files: cached copy first, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
