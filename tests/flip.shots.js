/* Capturas de la tarjeta del barbero: cerrada y dada vuelta, con los datos
   REALES de Firestore, en los dos temas y en celular. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  for (const [tema, w, h] of [
    ["dark", 1440, 900],
    ["light", 1440, 900],
    ["dark", 390, 844],
  ]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w <= 900, hasTouch: w <= 900 });
    const p = await ctx.newPage();
    await p.addInitScript((t) => localStorage.setItem("theme", t), tema);
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-barber", { timeout: 25000 });
    await p.waitForTimeout(4000);

    const eq = await p.$("#equipo");
    if (eq) await eq.scrollIntoViewIfNeeded();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `tests/tmp_shots/flip-${tema}-${w}-cerrada.png` });

    if ((await p.locator(".lb-barber").count()) >= 1) {
      await p.locator(".lb-barber").first().click();
      await p.waitForTimeout(900);
      await p.screenshot({ path: `tests/tmp_shots/flip-${tema}-${w}-abierta.png` });
    }
    /* Las dos abiertas a la vez no pueden pasar: se comprueba abriendo la
       segunda y mirando que la primera se cerró. */
    if ((await p.locator(".lb-barber").count()) >= 2) {
      await p.locator(".lb-barber").nth(1).click();
      await p.waitForTimeout(900);
      await p.screenshot({ path: `tests/tmp_shots/flip-${tema}-${w}-segunda.png` });
    }
    console.log(tema, w, "abiertas:", await p.evaluate(() => document.querySelectorAll(".lb-barber--abierta").length));
    await ctx.close();
  }
  await b.close();
  console.log("listo");
})();
