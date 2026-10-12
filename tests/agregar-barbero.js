/* Carga un barbero SIN cuenta desde el panel del dueño, usando el botón
   "+ Agregar barbero" de verdad (no una escritura directa a Firestore), para
   probar además que ese botón funciona.

   Se usa cuando todavía no hay ningún barbero en la base y el sitio no puede
   tomar turnos: sin nadie en la lista, el asistente de reserva se frena en el
   paso 2.

   Uso:  node tests\agregar-barbero.js "Roman" [porcentajeBarbero]
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

const NOMBRE = process.argv[2] || "Roman";
/* El campo del formulario es el % que se queda el BARBERO. El dueño guardó
   40% para sí, o sea que el barberoava 60%. */
const PD_BARBERO = +(process.argv[3] || 60);

let fallos = 0;
const ok = (c, m) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) fallos++;
};

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 1050 } })).newPage();
  const errores = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text().slice(0, 140)));

  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(900);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 20000 });
  await page.fill("#ie", env.DUENO_EMAIL);
  await page.fill("#ip", env.DUENO_PASSWORD);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(13000);
  const uid = await page.evaluate(() => (window.__test ? window.__test.uid : null));
  if (!uid) {
    console.log("No entró el dueño. Revisá DUENO_* en .env.local.");
    await b.close();
    process.exit(1);
  }
  console.log("Dueño dentro.");

  await page.locator('#nav button:has-text("Barberos")').first().click();
  await page.waitForTimeout(2500);

  const antes = await page.evaluate(() =>
    [...document.querySelectorAll("#app .card")]
      .filter((c) => c.querySelector('[data-act="askQuitBar"]'))
      .map((c) => (c.querySelector("h2") || {}).textContent),
  );
  console.log("Barberos ahora: " + JSON.stringify(antes));

  if (antes.indexOf(NOMBRE) >= 0) {
    console.log(`\n"${NOMBRE}" ya está en la lista: no se agrega de nuevo.`);
    console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
    await b.close();
    process.exit(fallos ? 1 : 0);
  }

  /* El botón del mockup: "+ Agregar barbero". */
  await page.locator('button:has-text("Agregar barbero")').first().click();
  await page.waitForTimeout(900);

  const campos = await page.evaluate(() => ({
    hayNombre: !!document.getElementById("nbN"),
    ids: [...document.querySelectorAll("#mo input, #mo select")].map((x) => x.id || x.type),
  }));
  ok(campos.hayNombre, "el cartel pide el nombre", JSON.stringify(campos.ids));

  await page.fill("#nbN", NOMBRE);
  /* El select de porcentaje: se elige por texto para no depender del índice. */
  const selPd = await page.evaluate(() => {
    const s = [...document.querySelectorAll("#mo select")][0];
    if (!s) return null;
    const o = [...s.options].find((x) => x.value === "60") || [...s.options][1];
    return o ? o.value : null;
  });
  if (selPd != null) {
    await page.evaluate(() => {
      const s = [...document.querySelectorAll("#mo select")][0];
      const o = [...s.options].find((x) => x.value === "60") || [...s.options][1];
      s.value = o.value;
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await page.waitForTimeout(300);

  await page.click("#mok");
  await page.waitForTimeout(6000);

  const despues = await page.evaluate(() =>
    [...document.querySelectorAll("#app .card")]
      .filter((c) => c.querySelector('[data-act="askQuitBar"]'))
      .map((c) => (c.querySelector("h2") || {}).textContent),
  );
  console.log("Barberos después: " + JSON.stringify(despues));
  ok(despues.indexOf(NOMBRE) >= 0, `"${NOMBRE}" aparece en la lista del dueño`);
  ok(despues.length === antes.length + 1, "se agregó exactamente uno", `${antes.length} -> ${despues.length}`);

  /* Y tiene que verse en la landing, sin sesión. */
  const anon = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await anon.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await anon.waitForTimeout(4000);
  const landing = await anon.evaluate(() => ({
    tarjetas: document.querySelectorAll(".lb-barber").length,
    nombres: [...document.querySelectorAll(".lb-barber-id b")].map((x) => x.textContent.trim()),
  }));
  ok(landing.tarjetas > 0, "la landing muestra al barbero", JSON.stringify(landing));
  ok(
    landing.nombres.some((x) => x.trim() === NOMBRE),
    "con el nombre correcto",
    JSON.stringify(landing.nombres),
  );

  const ruido = errores.filter((x) => !/favicon|Failed to load resource/i.test(x));
  console.log("\nerrores de consola: " + (ruido.length ? JSON.stringify(ruido.slice(0, 3)) : "ninguno"));
  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  console.log("\nLo que falta para que el barbero tenga agenda propia:");
  console.log("  hace falta su cuenta de Firebase (el que carga así es ficha pública,");
  console.log("  no entra al panel). Cuando me pases el mail lo vinculo.");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
