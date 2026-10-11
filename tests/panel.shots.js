/* Captura del panel del cliente con el rediseño, para comparar contra los
   mockups: escritorio y celular, Inicio y Reseña. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

function envLocal() {
  const o = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
  return o;
}

(async () => {
  const env = envLocal();
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 1100, "1440"], [390, 844, "390"]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w <= 900, hasTouch: w <= 900 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 25000 });
    await p.waitForTimeout(1200);
    const vis = p.locator('[data-act="goLogin"]:visible');
    if (await vis.count()) await vis.first().click();
    else await p.evaluate(() => { location.hash = "#login"; });
    await p.waitForSelector("#ie", { timeout: 15000 });
    await p.fill("#ie", env.CLIENTE_EMAIL);
    await p.fill("#ip", env.CLIENTE_PASSWORD);
    await p.click('[data-act="entrar"]');
    await p.waitForTimeout(7000);

    for (const [nombre, hash] of [["inicio", "#/inicio"], ["resena", "#/resena"], ["ajustes", "#/mi-cuenta"]]) {
      await p.evaluate((hh) => { location.hash = hh; }, hash);
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `tests/tmp_shots/nuevo-${tag}-${nombre}.png`, fullPage: nombre !== "ajustes" });
    }
    /* El menú del perfil abierto. */
    await p.evaluate(() => { location.hash = "#/inicio"; });
    await p.waitForTimeout(1800);
    await p.click("#mebadge");
    await p.waitForTimeout(600);
    await p.screenshot({ path: `tests/tmp_shots/nuevo-${tag}-menu.png` });
    console.log(tag, "errores:", errs.length ? errs.slice(0, 2).join(" | ") : "ninguno");
    await ctx.close();
  }
  await b.close();
  console.log("listo");
})();