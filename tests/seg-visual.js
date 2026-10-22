/* Prueba visual del .seg (lote 44): en un esqueleto con el styles.css REAL,
   se mueve el thumb a las tres posiciones y se compara su caja contra la
   caja del botón de la columna correspondiente. Si difieren las vegas,
   sobra o falta un pixel de margen. Manual, no está en run.js. */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 460, height: 300 } })).newPage();
  await p.goto("file:///" + path.join(__dirname, "..", "tmp", "seg-probe.html").replace(/\\/g, "/"));
  await p.waitForTimeout(700);
  let malo = 0;
  for (const i of [0, 1, 2]) {
    await p.evaluate((n) => window.mover(n), i);
    await p.waitForTimeout(380); /* 300ms de transición + margen */
    const d = await p.evaluate((n) => {
      const th = document.querySelector(".seg-th").getBoundingClientRect();
      const bt = document.querySelectorAll(".seg-b")[n].getBoundingClientRect();
      return { dl: Math.round(th.left - bt.left), dt: Math.round(th.top - bt.top), dw: Math.round(th.width - bt.width), dh: Math.round(th.height - bt.height) };
    }, i);
    const ok = d.dl === 0 && d.dt === 0 && d.dw === 0 && d.dh === 0;
    console.log((ok ? "  OK    " : "  FALLA ") + "columna " + i + ": delta {l:" + d.dl + " t:" + d.dt + " w:" + d.dw + " h:" + d.dh + "}");
    if (!ok) malo++;
  }
  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "44-seg.png") });
  await b.close();
  console.log(malo ? "=== " + malo + " FALLAS ===" : "=== SEG en caja, 3 de 3 ===");
  process.exit(malo ? 1 : 0);
})();
