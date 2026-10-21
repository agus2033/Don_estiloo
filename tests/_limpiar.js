const fs = require("fs");
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
  .split(/\r?\n/)
  .forEach((s) => {
    const i = s.indexOf("=");
    if (i > 0 && s.slice(0, i).trim()) env[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  });

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 1100 } })).newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-wcard", { timeout: 45000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { location.hash = "#login"; });
  await page.waitForTimeout(1400);
  await page.fill("#ie", env.DUENO_EMAIL);
  await page.fill("#ip", env.DUENO_PASSWORD);
  await page.click('[data-act="entrar"]');
  await page.waitForTimeout(16000);

  /* Todos los períodos, a ver si hay pruebas en alguno. */
  for (const per of ["Todo", "Este mes", "7 días", "Hoy"]) {
    await page.evaluate(() => { location.hash = "#/finanzas"; });
    await page.waitForTimeout(1200);
    await page.evaluate((p) => {
      const b = [...document.querySelectorAll('[data-act="setPer"]')].find((x) => x.innerText.trim() === p);
      if (b) b.click();
    }, per);
    await page.waitForTimeout(2200);
    const g = await page.evaluate(() =>
      [...document.querySelectorAll(".scr .row")].map((x) => x.innerText.replace(/\s+/g, " ").trim()),
    );
    console.log("=== período '" + per + "' ===");
    g.forEach((x) => console.log("   " + x));
    if (!g.length) console.log("   (sin gastos)");
  }

  /* Borrar todo lo que tenga 'prueba' en el nombre, período por período. */
  console.log("\n=== borrando los gastos de prueba ===");
  let total = 0;
  for (const per of ["Todo", "Este mes", "7 días", "Hoy"]) {
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      await page.evaluate(() => { location.hash = "#/finanzas"; });
      await page.waitForTimeout(900);
      await page.evaluate((p) => {
        const b = [...document.querySelectorAll('[data-act="setPer"]')].find((x) => x.innerText.trim() === p);
        if (b) b.click();
      }, per);
      await page.waitForTimeout(1600);
      const borrado = await page.evaluate(() => {
        const filas = [...document.querySelectorAll(".scr .row")];
        const f = filas.find((x) => /prueba/i.test(x.innerText));
        if (!f) return 0;
        const btn = f.querySelector('[data-act="askGDel"]');
        if (!btn) return 0;
        btn.click();
        return 1;
      });
      if (!borrado) break;
      await page.waitForTimeout(1500);
      const okBtn = await page.evaluate(() => {
        const b = [...document.querySelectorAll("#mo button")];
        const e = b.find((x) => /Eliminar/i.test(x.innerText));
        if (!e) {
          return "no hay boton: " + JSON.stringify(b.map((x) => x.innerText.trim()));
        }
        e.click();
        return "ok";
      });
      if (okBtn !== "ok") { console.log("  (" + per + ") " + okBtn); break; }
      await page.waitForTimeout(3000);
      total++;
      console.log("  borrado " + total + " (" + per + ")");
    }
  }
  console.log("\n  gastos de prueba borrados: " + total);

  /* Comprobar que no queda nada. */
  console.log("\n=== verificando ===");
  for (const per of ["Todo", "Este mes", "7 días", "Hoy"]) {
    await page.evaluate(() => { location.hash = "#/finanzas"; });
    await page.waitForTimeout(900);
    await page.evaluate((p) => {
      const b = [...document.querySelectorAll('[data-act="setPer"]')].find((x) => x.innerText.trim() === p);
      if (b) b.click();
    }, per);
    await page.waitForTimeout(1800);
    const g = await page.evaluate(() =>
      [...document.querySelectorAll(".scr .row")].map((x) => x.innerText.replace(/\s+/g, " ").trim()),
    );
    console.log("  " + per.padEnd(10) + (g.length ? JSON.stringify(g) : "sin gastos  ok"));
  }

  console.log("\n  errores JS: " + (errs.length ? [...new Set(errs)].join(" | ") : "ninguno"));
  await b.close();
})();