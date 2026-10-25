/* Lote 51: sonda manual del título EN EL NAVEGADOR (no va en run.js).
   Comprueba lo que un test de archivos no puede: que después de que la app
   pinte (R()), `document.title` siga siendo el título largo y no vuelva a
   "SSJ Barber". Antes del lote 51 R() lo pisaba en cada pintado.

   Necesita el servidor local:  python -m http.server 8765
   Uso:  node tests\titulo-probe.js
   Sale con código 1 si el título se pisó. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const ESPERADO = "SSJ Barber | Barbería en Puerto Iguazú";
const BASE = "http://127.0.0.1:8765/index.html";

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  let okn = 0;
  const ok = (c, m, extra) => {
    if (c) {
      okn++;
      console.log("  OK    " + m);
    } else {
      console.log("  FALLA " + m + (extra ? "  -> " + extra : ""));
      process.exitCode = 1;
    }
  };

  const r = await page.goto(BASE, { waitUntil: "commit", timeout: 45000 });
  ok(!!r && r.status() === 200, "la página responde 200", r && r.status());

  /* Se lee con evaluate: page.title() justo en el commit puede devolver "" */
  const temprano = await page.evaluate(() => document.title);
  console.log(`  (título al cargar: ${JSON.stringify(temprano)})`);
  ok(temprano === ESPERADO, "el <title> del HTML ya viene completo", JSON.stringify(temprano));

  /* Se espera a que Firebase resuelva y R() pinte al menos una vez. */
  await page.waitForTimeout(7000);
  const tarde = await page.title();
  console.log(`  (título tras pintar: ${JSON.stringify(tarde)})`);

  ok(tarde === ESPERADO, "tras el pintado el título sigue completo", JSON.stringify(tarde));
  ok(tarde !== "SSJ Barber", "el título NO se pisa con el nombre pelado");

  const metas = await page.evaluate(() => ({
    og: (document.querySelector('meta[property="og:title"]') || {}).content || "",
    tw: (document.querySelector('meta[name="twitter:title"]') || {}).content || "",
    ld: (() => {
      const s = document.querySelector('script[type="application/ld+json"]');
      try {
        return JSON.parse(s.textContent).name;
      } catch (e) {
        return "";
      }
    })(),
  }));
  ok(metas.og === ESPERADO, "og:title en el DOM", JSON.stringify(metas.og));
  ok(metas.tw === ESPERADO, "twitter:title en el DOM", JSON.stringify(metas.tw));
  ok(metas.ld === "SSJ Barber", "JSON-LD name sigue siendo la marca", JSON.stringify(metas.ld));

  /* Un repintado más (cambio de tema): el título no debe cambiar. */
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(1500);
  ok((await page.title()) === ESPERADO, "otro pintado no lo cambia");

  await b.close();
  console.log(`\n${process.exitCode ? "HAY FALLAS" : "TODO VERDE"} — ${okn} checks`);
})();
