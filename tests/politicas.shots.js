/* Capturas del modal de políticas abierto, para comparar contra los mockups
   de Referencia (politicas-celular.png / politicas-completo.png).
   Recorre las 6 secciones en celular y en escritorio, en ambos temas. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const SECC = ["resumen", "datos", "uso", "derechos", "condiciones", "cambios"];

(async () => {
  const b = await chromium.launch();
  for (const [tema, w, h] of [
    ["dark", 390, 844],
    ["light", 1440, 900],
  ]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w <= 900, hasTouch: w <= 900 });
    const p = await ctx.newPage();
    await p.addInitScript((t) => localStorage.setItem("theme", t), tema);
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 20000 });
    await p.waitForTimeout(1200);
    await p.evaluate(() => { location.hash = "#login"; });
    await p.waitForSelector("#ie", { timeout: 15000 });
    await p.waitForTimeout(500);
    await p.locator('[data-act="openPol"]:visible').first().click();
    await p.waitForSelector("#po:not([hidden]) .polbox", { timeout: 8000 });
    await p.waitForTimeout(500);

    for (const s of SECC) {
      await p.evaluate((id) => {
        document.querySelectorAll("#po [data-panel]").forEach((x) => (x.hidden = x.dataset.panel !== id));
        document.querySelectorAll("#po .pol-tab").forEach((t) => t.classList.toggle("on", t.dataset.args === JSON.stringify([id])));
        document.querySelector("#po .pol-body").scrollTop = 0;
      }, s);
      await p.waitForTimeout(280);
      await p.screenshot({ path: `tests/tmp_shots/pol-${tema}-${w}-${s}.png` });
    }
    /* Una del cuerpo scrolleado a media altura: es donde se ve si el
       encabezado y el pie siguen en su lugar. */
    await p.evaluate(() => { document.querySelector("#po .pol-body").scrollTop = 400; });
    await p.waitForTimeout(250);
    await p.screenshot({ path: `tests/tmp_shots/pol-${tema}-${w}-scrolled.png` });
    await ctx.close();
  }
  await b.close();
  console.log("listo");
})();
