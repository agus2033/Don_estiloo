/* Deja el nombre del barbero como estaba (por defecto "asda"). Se usa cuando
   un test de nombres se corta a la mitad y deja "NOMBRE PRUEBA ..." puesto.

   Uso:  node tests\nombre.restaurar.js            (pregunta el nombre)
         node tests\nombre.restaurar.js asda       (lo pone sin preguntar)
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) return;
    const k = l.slice(0, i).trim();
    if (env[k]) return;
    env[k] = l.slice(i + 1).trim();
  });

(async () => {
  const destino = process.argv[2];
  if (!destino) {
    console.log("Uso: node tests\\nombre.restaurar.js <nombre>");
    console.log('Ej.: node tests\\nombre.restaurar.js asda');
    return;
  }

  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(900);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 15000 });
  await page.fill("#ie", env.BARBERO_EMAIL);
  await page.fill("#ip", env.BARBERO_PASSWORD);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(10000);

  const antes = await page.evaluate(() => {
    const x = document.querySelector("#app b");
    return x ? x.textContent.trim() : null;
  });
  console.log("nombre actual: " + JSON.stringify(antes));

  await page.click('[data-act="miPerfilWeb"]');
    await page.waitForSelector("#pfNombre", { timeout: 15000 });
  await page.fill("#pfNombre", destino);
  await page.click('[data-act="guardarPerfil"]');
  await page.waitForTimeout(6000);

  const despues = await page.evaluate(() => {
    const x = document.querySelector("#app b");
    return x ? x.textContent.trim() : null;
  });
  console.log("nombre nuevo : " + JSON.stringify(despues));
  console.log(despues === destino ? "LISTO" : "NO SE GUARDÓ");
  await b.close();
})();
