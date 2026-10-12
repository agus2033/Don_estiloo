/* Entra con las tres cuentas y dice qué panel abre cada una.

   Lo de "ya te di las cuentas nuevamente para que testees todo" hay que
   comprobarlo antes de prometer nada: si alguna no entra, las pruebas
  se saltan en silencio y eso parece verde.

   node tests\cuentas.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const env = {};
fs
  .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i < 1 || l.trim().startsWith("#")) return;
    const k = l.slice(0, i).trim();
    if (!env[k]) env[k] = l.slice(i + 1).trim();
  });

const ROLES = [
  { etq: "dueño", email: env.DUENO_EMAIL, pass: env.DUENO_PASSWORD, sec: 7 },
  { etq: "barbero", email: env.BARBERO_EMAIL, pass: env.BARBERO_PASSWORD, sec: 4 },
  { etq: "cliente", email: env.CLIENTE_EMAIL, pass: env.CLIENTE_PASSWORD, sec: 4 },
];

let fallos = 0;
(async () => {
  const b = await chromium.launch();
  for (const r of ROLES) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errores = [];
    page.on("pageerror", (e) => errores.push(String(e).slice(0, 90)));
    await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".lb-wcard", { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      location.hash = "#login";
    });
    await page.waitForSelector("#ie", { timeout: 20000 });
    await page.fill("#ie", r.email);
    await page.fill("#ip", r.pass);
    await page.click('[data-act="entrar"]');
    await page.waitForTimeout(14000);
    const st = await page.evaluate(() => {
      const t = window.__test || {};
      const nav = document.getElementById("nav");
      return {
        uid: t.uid || null,
        rol: t.rol || null,
        secs: nav ? [...nav.querySelectorAll("button")].filter((x) => x.getBoundingClientRect().height > 0).length : 0,
        hayError: !!document.querySelector(".modal.err, #mf"),
      };
    });
    const entro = !!st.uid;
    console.log(
      `${entro ? "  OK   " : "  FALLA"} ${r.etq.padEnd(8)} uid=${st.uid || "(no entró)"} rol=${st.rol || "?"} secciones=${st.secs}` +
        (errores.length ? `  errores JS: ${errores.join(" / ")}` : ""),
    );
    if (!entro) fallos++;
    await ctx.close();
    await new Promise((r2) => setTimeout(r2, 2500));
  }
  await b.close();
  console.log(fallos ? `\nFALLARON ${fallos} (las pruebas que usan esas cuentas NO se van a saltar)` : "\nLas tres cuentas entran");
  process.exit(fallos ? 1 : 0);
})();