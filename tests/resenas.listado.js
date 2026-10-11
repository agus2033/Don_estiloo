/* Lista el contenido de la colección `resenas` de producción para saber
   qué hay que borrar a mano. Sólo LEE. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-tst", { timeout: 25000 });
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const t = [...document.querySelectorAll(".lb-tst")].map((x) => ({
      texto: (x.querySelector("blockquote") || {}).textContent || "",
      autor: (x.querySelector("cite") || {}).textContent || "",
      estrellas: x.querySelectorAll(".lb-stars svg").length,
    }));
    const m = {};
    t.forEach((x) => { const k = (x.texto || "").trim(); m[k] = (m[k] || 0) + 1; });
    return { total: t.length, unicas: Object.entries(m), muestra: t.slice(0, 4) };
  });
  console.log("total de reseñas en el carrusel:", r.total);
  console.log("\npor texto (cuántas copias de cada una):");
  r.unicas.forEach(([txt, n]) => console.log(`  ${n}x  ${txt.slice(0, 100)}`));
  await b.close();
})();
