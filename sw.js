const V = "barberia-v7",
  SHELL = [
    "./",
    "index.html",
    "src/styles.css",
    "src/landing.css",
    "src/main.js",
    "src/boot.js",
    "src/config.js",
    "src/logic.js",
    "manifest.json",
    "assets/icon-192.png",
    "assets/icon-512.png",
    "assets/icon-maskable-512.png",
    "assets/apple-touch-icon.png",
    "assets/logo-256.png",
  ],
  OK = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
/* Un archivo faltante no debe romper la instalación: se cachea cada uno por separado. */
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(V)
      .then((c) =>
        Promise.all(SHELL.map((u) => c.add(u).catch(() => null))),
      ),
  ),
);
/* No hay skipWaiting automático: la versión nueva espera a que el usuario toque "Actualizar". */
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((k) =>
        Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x))),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (
    r.method !== "GET" ||
    (u.origin !== location.origin && !OK.includes(u.hostname))
  )
    return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res.ok || res.type === "opaque") {
          const c = res.clone();
          caches.open(V).then((x) => x.put(r, c));
        }
        return res;
      })
      .catch(() =>
        caches.match(r).then((m) => m || caches.match("index.html")),
      ),
  );
});
