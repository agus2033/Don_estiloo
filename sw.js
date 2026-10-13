const V = "barberia-v9",
  SHELL = [
    "./",
    "index.html",
    "src/styles.css",
    "src/landing.css",
    "src/main.js",
    "src/boot.js",
    "src/config.js",
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
        caches.match(r).then((m) => {
          /* El index como último recurso es SÓLO para las navegaciones: si el
             usuario está sin conexión y pide una página, se le muestra la app
             en vez del error del navegador.

             Antes caía para CUALQUIER pedido que fallara, y eso rompía la web
             de una forma muy difícil de ver: un módulo de Firebase o una hoja de
             estilos de Google que no cargaban recibían el index.html, y el
             navegador decía "Expected a JavaScript module script but the server
             responded with a MIME type of text/html" o "Refused to apply
             style", en vez de un error claro. Para un recurso que no es la
             página, lo correcto es dejar que falle. */
          if (m) return m;
          if (r.mode === "navigate") return caches.match("index.html");
          throw new Error("sin red y sin copia en caché: " + r.url);
        }),
      ),
  );
});
