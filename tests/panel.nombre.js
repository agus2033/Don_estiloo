/* Prueba del nombre del barbero en las TRES partes de la app.

   Escenario real que reportó el dueño: el barbero se cambia el nombre en
   "Mi perfil en la web" y el nombre no se ve ni en el encabezado del panel ni
   en la lista del dueño.

   Hace:
     1. El barbero cambia su nombre y guarda.
     2. Se verifica encabezado del panel, campo de la ficha y lista pública.
     3. Se recarga y se vuelve a verificar (contra Firestore de verdad).
     4. Entra el DUEÑO: la agenda y la lista de barberos no pueden volver al
        nombre viejo (ese era el pisón del sync).
     5. Se comprueba la landing sin sesión.
     6. Se devuelve el nombre original y se deja la base como estaba.

   OJO: escribe en la base real (el nombre del barbero) y al final lo restaura.
   Si se corta a la mitad queda "NOMBRE PRUEBA ..." puesto; se arregla con
   `node tests\nombre.restaurar.js <nombre>`.
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

const URL = "http://127.0.0.1:8765/index.html";
const PRUEBA = "NOMBRE PRUEBA " + Date.now().toString().slice(-5);

let fallos = 0;
const ok = (c, m) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) fallos++;
};

/* El <b> del bloque con la foto de arriba del todo: el nombre del panel. */
const encabezado = (page) =>
  page.evaluate(() => {
    const b = document.querySelector("#app b");
    return b ? b.textContent.trim() : null;
  });

const publicos = (page) => page.evaluate(() => window.__test.bars.map((x) => x.n));

/* "Cerrar sesión" no cierra nada directo: abre un cartel y hay que apretar el
   botón de adentro (#mok). Hay dos botones con ese data-act (el del panel y el
   del menú de perfil), así que se toma el visible. */
async function cerrarSesion(page) {
  const bot = page.locator('[data-act="salir"]:visible');
  if (!(await bot.count())) return;
  await bot.first().click();
  await page.waitForSelector("#mok", { timeout: 10000 });
  await page.click("#mok");
  await page.waitForTimeout(4000);
}

async function entrar(page, email, pass) {
  await cerrarSesion(page);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(900);
  const vis = page.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForSelector("#ie", { timeout: 20000 });
  await page.fill("#ie", email);
  await page.fill("#ip", pass);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(11000);
}

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });

  /* ---------- 1. el barbero cambia su nombre ---------- */
  console.log("\n1. El barbero se cambia el nombre en Mi perfil en la web");
  await entrar(page, env.BARBERO_EMAIL, env.BARBERO_PASSWORD);
  const original = await encabezado(page);
  console.log("   nombre original: " + JSON.stringify(original));
  ok(!!original && original !== PRUEBA, "arranca con un nombre real");

  await page.click('[data-act="miPerfilWeb"]');
    await page.waitForSelector("#pfNombre", { timeout: 15000 });
  await page.fill("#pfNombre", PRUEBA);
  await page.click('[data-act="guardarPerfil"]');
  await page.waitForTimeout(6000);

  ok((await encabezado(page)) === PRUEBA, "el encabezado del panel cambia al instante");
  ok((await publicos(page)).indexOf(PRUEBA) >= 0, "la lista pública toma el nombre nuevo");

  /* ---------- 2. contra Firestore, no contra memoria ---------- */
  console.log("\n2. Después de recargar la página (datos de verdad)");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(11000);
  ok((await encabezado(page)) === PRUEBA, "el encabezado sigue con el nombre nuevo tras recargar");
  ok((await publicos(page)).indexOf(PRUEBA) >= 0, "la lista pública sigue con el nombre nuevo");

  /* ---------- 3. el dueño no lo pisa al entrar ---------- */
  console.log("\n3. El dueño entra al panel (antes esto borraba el nombre)");
  await entrar(page, env.DUENO_EMAIL, env.DUENO_PASSWORD);
  console.log("   ruta del dueño: " + (await page.evaluate(() => location.hash)));

  const nav = page.locator("#nav button:visible");
  const etiquetas = await nav.allTextContents();
  ok(etiquetas.length > 0, "el dueño tiene su panel con navegación");

  /* La agenda del dueño: los chips de barbero de arriba. */
  const linkAg = page.locator('#nav button:has-text("Agenda")');
  if (await linkAg.count()) {
    await linkAg.first().click();
    await page.waitForTimeout(2200);
    const chips = await page.evaluate(() =>
      [...document.querySelectorAll("#app .chip")].map((x) => x.textContent.trim()),
    );
    ok(
      chips.some((t) => t === PRUEBA),
      "la agenda del dueño muestra el nombre nuevo",
    );
  } else {
    ok(false, "no se encontró la sección Agenda en el panel del dueño");
  }

  /* La lista "Barberos" del dueño. */
  const linkBar = page.locator('#nav button:has-text("Barberos")');
  if (await linkBar.count()) {
    await linkBar.first().click();
    await page.waitForTimeout(2200);
    const h2 = await page.evaluate(() =>
      [...document.querySelectorAll("#app h2")].map((x) => x.textContent.trim()),
    );
    ok(h2.indexOf(PRUEBA) >= 0, "la lista Barberos del dueño muestra el nombre nuevo");
  } else {
    ok(false, "no se encontró la sección Barberos en el panel del dueño");
  }

  /* ---------- 4. la landing, sin sesión ---------- */
  console.log("\n4. La landing, sin sesión");
  const anon = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  await anon.goto(URL, { waitUntil: "domcontentloaded" });
  await anon.waitForSelector(".lb-wcard", { timeout: 25000 });
  await anon.waitForTimeout(2500);
  ok(
    await anon.evaluate(() => document.body.innerText.indexOf("NOMBRE PRUEBA ") >= 0),
    "la landing muestra el nombre nuevo sin iniciar sesión",
  );

  /* ---------- 5. restaurar ---------- */
  console.log("\n5. Se devuelve el nombre original");
  await entrar(page, env.BARBERO_EMAIL, env.BARBERO_PASSWORD);
  await page.click('[data-act="miPerfilWeb"]');
    await page.waitForSelector("#pfNombre", { timeout: 15000 });
  await page.fill("#pfNombre", original);
  await page.click('[data-act="guardarPerfil"]');
  await page.waitForTimeout(6000);
  ok((await encabezado(page)) === original, "el encabezado volvió al nombre original");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 25000 });
  await page.waitForTimeout(11000);
  ok((await encabezado(page)) === original, "el nombre original quedó guardado en Firestore");
  ok((await publicos(page)).indexOf(PRUEBA) < 0, "no quedó el nombre de prueba en la lista pública");
  console.log("   restaurado a: " + JSON.stringify(original));

  const ruido = errs.filter((x) => !/favicon|Failed to load resource/i.test(x));
  console.log("\nerrores de consola: " + (ruido.length ? JSON.stringify(ruido.slice(0, 4)) : "ninguno"));
  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
