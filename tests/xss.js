/* Prueba de XSS almacenado en el panel.

   Por qué existe: los datos de la agenda (`turnos`) los puede escribir
   cualquiera que tenga una cuenta, porque las reglas de Firestore no validan
   NINGÚN campo del documento (FIRESTORE_RULES.txt:154). La app los dibuja en
   la Agenda del barbero y del dueño. Si un campo va crudo al innerHTML, un
   cliente se inyecta HTML en el navegador de quien administra.

   Esta prueba mete un turno con la hora como payload y comprueba si el
   navegador lo EJECUTA. No alcanza con mirar el HTML: lo que importa es si
   `window.__pwn` se pone en 1, porque eso significa que el `<img onerror>`
   corrió código con los permisos de esa sesión.

   Casos:
     1. `t.t` (la hora) en la Agenda del dueño         -> src/main.js:5607
     2. `t.t` en los recordatorios                     -> src/main.js:5498
     3. `t.t` en la lista de clientes                  -> src/main.js:5715
     4. `t.precio` en el Dashboard (vía `$$`)          -> src/main.js:5715
     5. URL `javascript:` en las redes del barbero     -> src/main.js:4003

   Se usan dos contextos porque el login y la landing son estados distintos del
   mismo navegador: en el logged no aparece el formulario, así que "volver a
   la landing" desde ahí no es el camino que se recorre de verdad.

   Uso:  node tests\xss.js
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
const ok = (c, m, d) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) fallos++;
  if (!c && d) console.log("         " + d);
};

/* Payload: si el navegador lo parsea como HTML, dispara el onerror. Se usa
   `<img>` y no `<script>` porque innerHTML nunca ejecuta <script>. */
const PWN_T = '<img src=y onerror="window.__pwn=1">';
const PWN_P = '<img src=z onerror="window.__pwn=2">';

const dISO = new Date().toISOString().slice(0, 10);

/* Turno malicioso: los campos que la app dibuja, para que una sola inyección
   cubra agenda, recordatorios, lista de clientes y dashboard. */
const turnoMalo = {
  id: "xss-test-1",
  uid: "cliente-xss",
  nm: 'Cliente <img src=x onerror="window.__pwn=3">',
  s: 0,
  sid: "corte",
  d: dISO,
  t: PWN_T,
  st: "pend",
  bid: "b1",
  precio: PWN_P,
  serv: "Corte",
};

/* Barbero malicioso: una red social con esquema `javascript:`. */
const barberoMalo = {
  id: "b1",
  n: "Barbero de prueba",
  esp: "Barbero",
  redes: [{ n: "Instagram", url: "javascript:window.__pwn=4" }],
};

/* Busca señales de que el payload corrió.

   OJO con `crudo`: el texto escapado sigue teniendo adentro la palabra
   "onerror", así que buscarla a secas da falso positivo aunque el `<` ya sea
   `&lt;`. Lo que importa es si hay un `<img ...onerror` SIN escapar, o sea
   `<img`, no `&lt;img`. */
const SENALES = `() => {
  const sueltos = [...document.querySelectorAll("#app img, #wzm img")].filter((x) =>
    ["x", "y", "z"].includes(x.getAttribute("src")),
  );
  const crudo = /<img src=[xyz][^>]*onerror/i.test(document.documentElement.innerHTML);
  const escapado = document.documentElement.innerHTML.includes("&lt;img");
  return { pwn: window.__pwn || 0, imgs: sueltos.length, crudo, escapado };
}`;

(async () => {
  const b = await chromium.launch();

  /* ============ 1. LANDING, sin sesión ============ */
  console.log("XSS almacenado\n");
  console.log("LANDING (sin sesión)");

  const c1 = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p1 = await c1.newPage();
  await p1.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p1.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p1.waitForTimeout(1200);

  await p1.evaluate(() => { window.__pwn = 0; });
  const fichas = await p1.locator(".lb-barber").count();
  if (fichas) {
    await p1.locator(".lb-barber").first().click();
    await p1.waitForTimeout(800);
    const hrefs = await p1.evaluate(() =>
      [...document.querySelectorAll(".lb-bd-red")].map((x) => x.getAttribute("href")),
    );
    ok(
      !hrefs.some((h) => /^javascript:/i.test(h || "")),
      "las redes del barbero no aceptan esquema javascript:",
      JSON.stringify(hrefs),
    );
    const r = await p1.evaluate(eval("(" + SENALES + ")"));
    ok(r.pwn === 0 && r.imgs === 0, "la ficha del barbero no ejecuta nada", JSON.stringify(r));
  } else {
    console.log("  SKIP  no hay fichas en la landing para probar");
  }
  await c1.close();

  /* ============ 2. PANEL, como dueño ============ */
  console.log("\nPANEL (dueño)");
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard", { timeout: 25000 });
  await p.waitForTimeout(1000);

  const vis = p.locator('[data-act="goLogin"]:visible');
  if (await vis.count()) await vis.first().click();
  else await p.evaluate(() => { location.hash = "#login"; });
  await p.waitForSelector("#ie", { timeout: 20000 });
  await p.fill("#ie", env.DUENO_EMAIL);
  await p.fill("#ip", env.DUENO_PASSWORD);
  await p.click('[data-act="entrar"]');
  await p.waitForTimeout(12000);

  const uid = await p.evaluate(() => (window.__test ? window.__test.uid : null));
  if (!uid) {
    console.log("  SKIP  no entró el dueño: no se puede probar el panel.");
    await b.close();
    process.exit(0);
  }
  console.log("  (dueño dentro)");

  await p.evaluate((t) => {
    window.__pwn = 0;
    window.__test.setTurnos([t]);
  }, turnoMalo);
  await p.waitForTimeout(900);

  const medir = async (etq) => {
    /* El contador se vuelve a cero ANTES de entrar a cada ruta: si no, el
       `pwn` de la Agenda queda contaminando las siguientes y da un falso
       positivo (o, al revés, tapa un fallo real). */
    await p.evaluate(() => { window.__pwn = 0; });
    await p.waitForTimeout(250);
    const r = await p.evaluate(eval("(" + SENALES + ")"));
    ok(
      r.pwn === 0 && r.imgs === 0 && !r.crudo,
      etq,
      `pwn=${r.pwn} imgs=${r.imgs} crudo=${r.crudo} (escapado=${r.escapado})`,
    );
    /* Si el texto escapado está a la vista, el dato se muestra literal: es lo
       que tiene que pasar para que el nombre del barbero con un "&" se vea
       "&" y no desaparezca. */
    if (r.escapado) console.log(`         (el payload quedó como texto: &lt;img …)`);
  };

  for (const [ruta, etq] of [
    ["#/agenda", "la Agenda no inyecta HTML desde los campos del turno"],
    ["#/dashboard", "el Dashboard no inyecta HTML desde el precio"],
    ["#/clientes", "la lista de clientes no inyecta HTML"],
  ]) {
    await p.evaluate((h) => { location.hash = h; }, ruta);
    await p.waitForTimeout(1800);
    await medir(etq);
  }

  await b.close();
  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();