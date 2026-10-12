/* ¿La CSP deja entrar al popup de Google y al de Facebook?

   Esta prueba existe por un bug real: la CSP del lote 20 tenía
   `script-src 'self' https://www.gstatic.com https://identitytoolkit...`, y el
   popup de Firebase inyecta `https://apis.google.com/js/api.js` dentro de la
   ventana emergente. Como ese origen no estaba, el script se bloqueaba, la
   ventana NUNCA se abría y el login moría con `auth/internal-error` ("Intenta
   de nuevo"). En la consola parecía un problema de Google; era la CSP.

   Lo segundo que faltaba era `frame-src`: con el popup abierto, el iframe de
   Firebase (`*.firebaseapp.com`) tampoco estaba permitido.

   Cómo comprueba, sin inventarse nada:
     1. El texto de la CSP tiene que traer los orígenes que sececitan abajo.
     2. Se aprieta Google y Facebook de verdad, contra el servidor CON CSP.
     3. La ventana tiene que abrir Y quedarse en el dominio del proveedor. Sólo con
        esto se puede decir que el flujo llegó a destino: si el script se
        bloquea, no hay popup, y "cero violaciones" pasaría por verde.
     4. Cero violaciones de CSP en la consola, incluida la del popup.

   node tests\csp.popup.js [puerto]      (por defecto 8766)
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const PUERTO = process.argv[2] || "8766";
const BASE = `http://127.0.0.1:${PUERTO}/index.html`;

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

/* Los orígenes que la CSP tiene que permitir. Se citan explícitamente porque
   el bug anterior fue justo un origen que faltaba y no se notó: */
const REQUERIDOS = [
  ["script-src", "https://apis.google.com"],
  ["script-src", "https://www.gstatic.com"],
  ["frame-src", "https://*.firebaseapp.com"],
];

const PROVEEDORES = [
  { etq: "Google", btn: "Google", dominio: "accounts.google.com" },
  { etq: "Facebook", btn: "Facebook", dominio: "facebook.com" },
];

(async () => {
  console.log("=== 1. la CSP trae los orígenes que hacen falta ===");
  const cspTxt = fs
    .readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8")
    .match(/"value": "default-src[^"]*/)[0];
  for (const [dir, org] of REQUERIDOS) {
    const bloque = cspTxt.split(`${dir} `)[1] || "";
    ok(bloque.split(";")[0].includes(org), `${dir} permite ${org}`);
  }

  console.log("\n=== 2. el popup abre y llega al proveedor ===");
  const b = await chromium.launch();
  const ctx0 = await b.newContext({ viewport: { width: 440, height: 956 } });
  const page = await ctx0.newPage();
  const violaciones = [];
  const espiar = (p, quien) =>
    p.on("console", (m) => {
      const t = m.text();
      if (!/violates the following Content Security Policy/i.test(t)) return;
      violaciones.push(
        `${quien}: ${(t.match(/'(https?:\/\/[^']+)'/) || [])[1] || "?"} contra ` +
          ((t.match(/directive:\s*"?([a-z-]+)/i) || [])[1] || "?"),
      );
    });
  espiar(page, "página");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    location.hash = "#login";
  });
  await page.waitForSelector('[data-act="red"]', { timeout: 20000 });

  for (const p of PROVEEDORES) {
    const sel = `[data-act="red"]:has-text("${p.btn}")`;
    if (!(await page.locator(sel).count())) {
      ok(false, `el botón de ${p.etq} está en la pantalla de ingreso`);
      continue;
    }
    const popup = ctx0.waitForEvent("page", { timeout: 25000 }).catch(() => null);
    await page.locator(sel).first().click();
    const p2 = await popup;
    ok(!!p2, `${p.etq}: se abre la ventana emergente`);
    if (!p2) continue;
    espiar(p2, `${p.etq} (popup)`);
    let ultima = "";
    p2.on("framenavigated", (f) => {
      if (f === p2.mainFrame()) ultima = f.url();
    });
    await p2.waitForTimeout(7000).catch(() => {});
    const u = ultima || p2.url() || "";
    ok(
      u.includes(p.dominio),
      `${p.etq}: el popup llega a ${p.dominio}`,
      u.slice(0, 110) || "(url vacía)",
    );
    /* Que la pantalla se pinte y no quede en blanco. */
    const pintado = await p2
      .evaluate(() => document.body ? document.body.innerText.trim().length : 0)
      .catch(() => 0);
    ok(pintado > 0, `${p.etq}: la pantalla de ingreso se dibuja (${pintado} caracteres)`, "");
    await p2.close().catch(() => {});
  }

  console.log("\n=== 3. cero violaciones de CSP en todo el flujo ===");
  ok(
    violaciones.length === 0,
    `ningún origen bloqueado (${violaciones.length})`,
    [...new Set(violaciones)].join(" | "),
  );

  await b.close();
  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();