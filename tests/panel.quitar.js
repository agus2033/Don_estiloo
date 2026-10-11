/* Botón "Quitar" de los barberos cargados a mano (+ Agregar barbero).

   El bug: askQuitBar buscaba el barbero con `(uid ? x.uid === uid : x.id ===
   uid)`. A un barbero sin cuenta se le pasa su `id`, así que la condición
   terminaba siempre en `x.uid === "b1abc..."`, que no lo matchea nunca,
   `b` quedaba indefinido y la función salía sin hacer nada: el botón no
   abría cartel, no pasaba nada y no había error en consola.

   Esta prueba NO borra nada: abre el cartel y lo cierra. Para borrar de verdad
   hay que apretar "Quitar" adentro, y eso lo hacés vos.
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

let fallos = 0;
const ok = (c, m) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) fallos++;
};

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });

  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(900);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 15000 });
  await page.fill("#ie", env.DUENO_EMAIL);
  await page.fill("#ip", env.DUENO_PASSWORD);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(11000);

  await page.locator('#nav button:has-text("Barberos")').first().click();
  await page.waitForTimeout(2200);

  /* La tarjeta de cada barbero. Los que tienen cuenta dicen "Vuelve a ser un
     cliente común"; los agregados a mano, "no tiene cuenta de barbero". */
  const tarjetas = await page.evaluate(() =>
    [...document.querySelectorAll("#app .card")]
      .filter((c) => c.querySelector('[data-act="askQuitBar"]'))
      .map((c, i) => ({
        i,
        nombre: (c.querySelector("h2") || {}).textContent || "",
        argumento: c.querySelector('[data-act="askQuitBar"]').dataset.args,
      })),
  );
  console.log("  barberos en la lista: " + JSON.stringify(tarjetas));
  ok(tarjetas.length > 0, "hay tarjetas con botón Quitar");

  for (const t of tarjetas) {
    /* Por posición y no por selector: `data-args` es un JSON con comillas
       y no se puede meter en un selector de CSS. */
    await page.locator('[data-act="askQuitBar"]').nth(t.i).click();
    await page.waitForTimeout(700);
    const cartel = await page.evaluate(() => {
      const m = document.getElementById("mo");
      return m && !m.hidden ? m.innerText.replace(/\s+/g, " ").trim() : null;
    });
    ok(!!cartel, `«Quitar» de ${t.nombre} abre el cartel de confirmación`);
    if (cartel) console.log(`         dice: ${cartel.slice(0, 130)}`);

    /* Se cierra SIN confirmar. Se aprieta por su `data-act` (`Mx` = cancelar)
       y NO por el texto: si el dueño cambia la palabra "Volver" por otra, un
       filtro por texto deja de encontrar el cancelar y el `.first()` se cae
       en el de confirmar, que borra un barbero de verdad. */
    const cancelar = page.locator('#mo [data-act="Mx"]');
    ok((await cancelar.count()) === 1, `el cartel de ${t.nombre} tiene botón de cancelar`);
    await cancelar.click();
    await page.waitForTimeout(700);
    ok(
      await page.evaluate(() => document.getElementById("mo").hidden),
      `el cartel de ${t.nombre} se cierra sin borrar`,
    );
  }

  /* La comprobación de que no se borró nadie va DESPUÉS de que escriba
     Firestore: `quitBar` es async y el snapshot tarda en volver. Con la
     espera corta de antes, un borrado se seguía sin ver. */
  await page.waitForTimeout(4000);
  const despues = await page.evaluate(
    () => [...document.querySelectorAll("#app .card")].filter((c) => c.querySelector('[data-act="askQuitBar"]')).length,
  );
  const enFirestore = await page.evaluate(() => (window.__test.bars || []).length);
  ok(despues === tarjetas.length, `siguen los ${tarjetas.length} barberos en el panel (no se borró ninguno)`);
  ok(enFirestore === tarjetas.length, `y en Firestore también (config/barberos)`, `panel=${despues} firestore=${enFirestore}`);

  const ruido = errs.filter((x) => !/favicon|Failed to load resource/i.test(x));
  console.log("\nerrores de consola: " + (ruido.length ? JSON.stringify(ruido.slice(0, 3)) : "ninguno"));
  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
