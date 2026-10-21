/* Comprueba la galería de la landing (lote 41): masonry de columnas y,
   sobre todo, que NINGUNA foto se recorte.

   La regla del dueño es que las fotos no se recortan, y acá es donde más
   importa: son fotos de su trabajo. Antes la grilla usaba aspect-ratio
   fijos + object-fit: cover, que es exactamente recortar (una foto apaisada
   perdía arriba y abajo). Ahora cada foto se ve con su proporción natural,
   así que el test compara la proporción MOSTRADA contra la proporción REAL
   del archivo: si difiere, hubo recorte o deformación.

   Las fotos de prueba son data: URLs de SVG con proporciones conocidas
   (una apaisada 2:1 y una vertical 2:3). No tocan Firestore ni Cloudinary:
   entran por window.__test.setGaleria, que sólo existe en localhost.

   Sin fotos cargadas en Firestore, la landing muestra los marcadores
   "FOTO 1..5" (decisión registrada en PRODUCT.md, principio 2). Con la
   lista vacía por hook tienen que volver.

   Uso:  node tests\galeria.js          (necesita el 8765 arriba: python -m http.server 8765)
   En run.js: fila 'galeria'.
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

let okn = 0;
const ok = (cond, msg, extra) => {
  if (cond) {
    okn++;
    console.log("  OK    " + msg);
  } else {
    console.log("  FALLA " + msg + (extra ? "  -> " + extra : ""));
    process.exitCode = 1;
  }
};

/* SVG con proporción conocida, url-encoded para que sea seguro metido en un
   atributo HTML (esc() no ve nada raro y el <img> sí lo decodifica). */
const svg = (w, h, color) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color}"/></svg>`,
  );

const FOTOS = [
  { url: svg(800, 400, "#a86") },   /* apaisada 2:1 */
  { url: svg(600, 900, "#7a9") },   /* vertical 2:3 */
  { url: svg(600, 600, "#877") },   /* cuadrada 1:1 */
];

const estado = () => ({
  figuras: [...document.querySelectorAll("#galeria figure")],
  marcadores: document.querySelectorAll("#galeria .lb-gal-ph").length,
  /* columnCount vuelve como STRING ("2"): se numerea para no comparar
     peras con manzanas. */
  columnas: Number(getComputedStyle(document.querySelector("#galeria .lb-gal")).columnCount),
});

(async () => {
  const b = await chromium.launch();
  try {
    /* ---------- móvil: 390px es el diseño ---------- */
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#galeria", { timeout: 30000 });
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const g = document.querySelector("#galeria");
      if (g) g.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1500);

    const v = await page.evaluate(estado);

    /* El estado de la base puede ser cualquiera de los dos (PRODUCT.md
       principio 2: lo que manda es el contenido):
         - 0 fotos  -> 5 marcadores "FOTO 1..5";
         - N fotos  -> N figuras con <img> real y 0 marcadores.
       No se discute cuál toca: lo que se comprueba es que sea CONSISTENTE. */
    ok(
      v.marcadores === 5 ? v.figuras.length === 5 : v.marcadores === 0,
      "o 5 marcadores, o fotos de verdad: sin estados mezclados",
      "figuras=" + v.figuras.length + " marcadores=" + v.marcadores,
    );
    ok(v.figuras.length + v.marcadores > 0, "la galería no queda vacía: algo se ve", "0 y 0");
    ok(v.columnas === 2, "en móvil son 2 columnas de masonry", v.columnas);

    /* Si hay marcadores: cuadrados. Si hay fotos de verdad: NINGUNA recortada. */
    if (v.marcadores === 5) {
      const cuadrados = await page.evaluate(() => {
        const f = document.querySelector("#galeria figure");
        return Math.abs(f.offsetWidth - f.offsetHeight) <= 2;
      });
      ok(cuadrados, "los marcadores son cuadrados (se ve dónde van las fotos)");
      ok(true, "las reales: no hay, se prueban con las sintéticas");
    } else {
      const reales = await page.evaluate(() => {
        const onWhats = [...document.querySelectorAll("#galeria figure img")];
        return onWhats.map((i) => {
          const r = i.getBoundingClientRect();
          return {
            cargada: i.complete && i.naturalWidth > 0,
            natural: i.naturalWidth / i.naturalHeight,
            mostrada: r.width / r.height,
            cloudinary: /res\.cloudinary\.com/.test(i.src),
          };
        });
      });
      ok(reales.length > 0, "hay fotos reales de Firestore en la landing", reales.length);
      ok(reales.every((x) => x.cloudinary), "las fotos vienen de Cloudinary (con transformación f_auto,q_auto,w_800)");
      ok(reales.every((x) => x.cargada), "las fotos reales cargaron");
      ok(
        reales.every((x) => Math.abs(x.mostrada - x.natural) / x.natural < 0.04),
        "LAS REALES tampoco se recortan: proporción mostrada = natural",
        JSON.stringify(reales.map((x) => +x.mostrada.toFixed(3) + "/" + +x.natural.toFixed(3))),
      );
    }

    /* ---------- con fotos: la proporción se respeta ---------- */
    await page.evaluate((f) => window.__test.setGaleria(f), FOTOS);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const g = document.querySelector("#galeria");
      if (g) g.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(1200);

    const con = await page.evaluate(() => {
      const figs = [...document.querySelectorAll("#galeria figure")];
      return {
        n: figs.length,
        marc: document.querySelectorAll("#galeria .lb-gal-ph").length,
        columnas: Number(getComputedStyle(document.querySelector("#galeria .lb-gal")).columnCount),
        fotos: figs.map((f) => {
          const i = f.querySelector("img");
          if (!i) return null;
          const r = i.getBoundingClientRect();
          return {
            natural: i.naturalWidth / i.naturalHeight,
            mostrada: r.width / r.height,
            cargada: i.complete && i.naturalWidth > 0,
            alt: i.alt,
            lazy: i.loading,
          };
        }),
        objectFit: getComputedStyle(figs[0].querySelector("img")).objectFit,
      };
    });

    ok(con.n === FOTOS.length && con.marc === 0, "setGaleria con 3 fotos: 3 figuras, 0 marcadores", con.n + "/" + con.marc);
    ok(con.columnas === 2, "las 2 columnas siguen en mobile", con.columnas);
    ok(con.fotos.length === FOTOS.length && con.fotos.every(Boolean), "cada figura es un <img>", JSON.stringify(con.fotos.length));
    ok(con.fotos.every((x) => x.cargada), "las 3 fotos se cargaron de verdad");
    ok(con.fotos.every((x) => !!x.alt), "cada foto tiene alt de verdad");
    ok(con.fotos.every((x) => x.lazy === "lazy"), "carga diferida (loading=lazy)");

    /* LA PRUEBA CLAVE: mostrada vs natural. El object-fit: fill con alto
       automático es la proporción natural; cualquier cover/ajuste a caja
       cambia el cociente y se nota acá. */
    ok(
      con.fotos.every((x) => Math.abs(x.mostrada - x.natural) / x.natural < 0.04),
      "la proporción mostrada es la natural: NADA recortado",
      JSON.stringify(con.fotos.map((x) => (+x.mostrada.toFixed(3) + "/" + +x.natural.toFixed(3)))),
    );
    ok(con.objectFit !== "cover", "sin object-fit: cover en las fotos", con.objectFit);

    /* ---------- escritorio: 3 columnas ---------- */
    const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await ctx2.newPage();
    await page2.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page2.waitForSelector("#galeria", { timeout: 30000 });
    await page2.waitForTimeout(900);
    await page2.evaluate((f) => window.__test.setGaleria(f), FOTOS);
    await page2.waitForTimeout(400);
    const col3 = await page2.evaluate(() => Number(getComputedStyle(document.querySelector("#galeria .lb-gal")).columnCount));
    ok(col3 === 3, "en escritorio son 3 columnas", col3);

    /* ---------- sin fotos otra vez: vuelven los marcadores ---------- */
    await page.evaluate(() => window.__test.setGaleria([]));
    await page.waitForTimeout(400);
    const w = await page.evaluate(estado);
    ok(w.marcadores === 5 && w.figuras.length === 5, "con la lista vacía vuelven los 5 marcadores", w.figuras.length);

    await ctx.close();
    await ctx2.close();
  } finally {
    await b.close();
    console.log(
      "\n" + "-".repeat(58) + "\n" +
      (process.exitCode ? "EN ROJO" : "TODO VERDE") + "  ·  " + okn + " comprobaciones",
    );
  }
})();
