/* Antes de borrar el bloque .lnd-* de styles.css (~líneas 2160-2350, restos de
   una landing vieja), hay que saber con certeza qué selectores siguen vivos.
   No sirve con buscar el nombre de la clase: muchos selectores son
   compuestos (.body.login .lnd, .soc, #cf-status) y hay @media metidas en
   medio. Este script recorre el CSSOM real y cruza cada selector con el
   DOM de las tres vistas (landing, login, panel). */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb", { timeout: 20000 });
  await page.waitForTimeout(2500);

  /* El modal de políticas vive FUERA de #app y arranca oculto: sin abrirlo,
     todos los .pol-* darían "no matchea nada" y el script los marcaría
     como borrables cuando en realidad están en uso. Se abre antes de
     escanear. */
  await page.evaluate(() => {
    location.hash = "#login";
  });
  await page.waitForSelector("#ie", { timeout: 15000 });
  await page.waitForTimeout(600);
  const link = page.locator('[data-act="openPol"]:visible');
  if (await link.count()) {
    await link.first().click();
    await page.waitForSelector("#po:not([hidden]) .polbox", { timeout: 8000 });
    await page.waitForTimeout(400);
    console.log("modal de políticas abierto para el escaneo");
  }

  /* Recorre todas las hojas y saca los selectores cuyo texto mencione lnd
     o los compuestos sospechosos, con su línea de origem si se puede. */
  const reglas = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rs;
      try {
        rs = sheet.cssRules;
      } catch (e) {
        continue;
      }
      const walk = (list, ctxMedia) => {
        for (const r of list) {
          if (r.cssRules && !r.selectorText) {
            walk(r.cssRules, r.conditionText || ctxMedia || "");
            continue;
          }
          if (!r.selectorText) continue;
          out.push({ sel: r.selectorText, media: ctxMedia || "" });
        }
      };
      walk(rs, "");
    }
    return out;
  });

  /* Campos que se buscan: las clases de la landing vieja (.lnd-*), las del
     modal de políticas (.pol-*) y un par de compuestos que no aparecen por
     nombre de clase (body.login, #cf-*, .soc, .btn-contact). Cuando se
     escriba un bloque de CSS nuevo con prefijo propio, agregarlo acá.

     Se descartan los selectores con pseudo: `:hover`, `:focus-visible`,
     `::before`, `::-webkit-scrollbar`… no se pueden comprobar con
     querySelectorAll (nunca matchean), así que aparecerían como "muertos"
     siendo código en uso. */
  const esPseudo = (sel) => /::|:hover|:focus|:active|:checked|:disabled|:nth-|:not\(/.test(sel);
  const objetivo = reglas.filter(
    (r) => /\.lnd-|\.pol-|\.soc\b|body\.login|#cf-|btn-contact/.test(r.sel) && !esPseudo(r.sel),
  );
  console.log(`selectores sospechosos en el CSSOM: ${objetivo.length}\n`);

  /* Para cada uno, ¿existe algún elemento que lo matchee en el DOM?
     TODO en UNA sola pasada dentro de la página: hacerlo selector por
     selector son ~170 viajes de ida y vuelta y el contexto se cae a
     mitad (Target closed). Además es 100 veces más rápido. */
  const sels = objetivo.map((r) => r.sel);
  const cuenta = await page.evaluate((lista) => {
    const out = [];
    for (const s of lista) {
      let n = 0;
      try {
        n = document.querySelectorAll(s).length;
      } catch (e) {
        n = -1; // selector inválido
      }
      out.push(n);
    }
    return out;
  }, sels);

  const muertos = [];
  const vivos = [];
  objetivo.forEach((r, i) => {
    const n = cuenta[i];
    (n > 0 ? vivos : muertos).push({ ...r, n });
  });

  console.log(`=== VIVOS (${vivos.length}) — NO borrar ===`);
  vivos.forEach((r) => console.log(`  [${r.n}] ${r.sel}${r.media ? "  @" + r.media : ""}`));
  /* Falsos positivos conocidos: este script sólo ve la LANDING (y el modal
     de políticas, que se abre antes de escanear). Las clases que sólo
     existen en el PANEL con sesión —la vista Galería usa .lnd-gal— dan
     "0 elementos" y salen como borrables sin serlo. Antes de borrar algo
     de esta lista, cruzalo con Select-String sobre src/main.js. */
  const SOLO_PANEL = [".lnd-gal", ".lnd-gal img", ".lb-nav"];
  const falsos = muertos.filter((r) => SOLO_PANEL.some((s) => r.sel.includes(s)));

  console.log(`=== MUERTOS (${muertos.length}) — borrables ===`);
  muertos.forEach((r) => {
    const falso = SOLO_PANEL.some((s) => r.sel.includes(s));
    console.log(`  ${r.sel}${r.media ? "  @" + r.media : ""}${falso ? "   <-- sólo vive en el panel: NO borrar sin verificar" : ""}`);
  });
  console.log(`\n(${falsos.length} de ${muertos.length} son falsos positivos del panel, no código muerto)`);

  await browser.close();
})();
