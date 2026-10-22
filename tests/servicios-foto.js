/* Captura de las tarjetas de servicios con los datos REALES de la base,
   en los dos anchos que se usan: >=1280 muestra la GRILLA de tarjetas;
   abajo de eso la lista de filas. Manual, no está en run.js. */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  for (const w of [1440, 390]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
    await p.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded", timeout: 60000 });
    /* en >=1280 la grilla es visible y la lista de filas NO (y viceversa):
       cada ancho espera SU selector (la espera conjunta resuelve al primero
       que matchea, aunque esté display:none, y ahí se corta a los 45s). */
    const sel = w >= 1280 ? ".lb-sv-grid article" : ".lb-sv-list-m .lb-sv-row";
    await p.waitForSelector(sel, { state: "visible", timeout: 45000 });
    await p.evaluate(() => document.getElementById("servicios").scrollIntoView());
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "47-servicios-" + w + ".png"), fullPage: false });
    const d = await p.evaluate(() => {
      if (matchMedia("(min-width: 1280px)").matches) {
        const cards = [...document.querySelectorAll(".lb-sv-grid article")];
        return {
          vista: "grilla",
          n: cards.length,
          sinFotos: cards.filter((c) => c.querySelector(".lb-sv-falta")).length,
          /* top del texto de cada tarjeta: idéntico => alineadas */
          tops: cards.map((c) => Math.round(c.querySelector("h3").getBoundingClientRect().top)),
          /* top del pie (duración/precio) */
          pies: cards.map((c) => Math.round(c.querySelector(".lb-sv-ft").getBoundingClientRect().top)),
        };
      }
      const rows = [...document.querySelectorAll(".lb-sv-list-m .lb-sv-row")];
      if (rows.length) {
        return {
          vista: "filas",
          n: rows.length,
          sinFotos: rows.filter((r) => !r.querySelector("img")).length,
          tops: rows.map((r) => Math.round(r.querySelector("b").getBoundingClientRect().top)),
          pies: rows.map((r) => Math.round(r.querySelector(".lb-price, .lb-sv-row-t small").getBoundingClientRect().top)),
        };
      }
      return { vista: "vacía", nota: "sin servicios cargados" };
    });
    console.log(w + "px: " + JSON.stringify(d));
    await p.close();
  }
  await b.close();
})();
