/* Verifica el modo claro en los paneles: antes el toggle cambiaba la landing
   pero los paneles seguían oscuros (styles.css no redefinía los tokens).
   Uso: python -m http.server 8765   ->   node tests\landing.tema.js
*/
const fs = require("fs");
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

function envLocal() {
  const o = {};
  fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) o[m[1]] = m[2];
    });
  return o;
}

let fallos = 0;
const check = (ok, txt, extra) => {
  if (!ok) fallos++;
  console.log((ok ? "  OK   " : "  FALLA") + " " + txt + (extra ? "  -> " + extra : ""));
};

/* rgb() o color(srgb ...) -> [r,g,b] */
const parse = (s) => {
  const t = String(s || "");
  const c = t.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (c) return [+c[1] * 255, +c[2] * 255, +c[3] * 255];
  const n = (t.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  return n;
};
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

(async () => {
  const E = envLocal();
  const b = await chromium.launch();

  for (const rol of ["cliente", "dueno"]) {
    console.log("\n===== " + rol.toUpperCase() + " =====");
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));

    await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lb-wcard", { timeout: 25000 });
    await p.waitForTimeout(1300);
    await p.evaluate(() => { location.hash = "#login"; });
    await p.waitForSelector("#ie", { timeout: 12000 });
    await p.waitForTimeout(300);
    await p.fill("#ie", rol === "dueno" ? E.DUENO_EMAIL : E.CLIENTE_EMAIL);
    await p.fill("#ip", rol === "dueno" ? E.DUENO_PASSWORD : E.CLIENTE_PASSWORD);
    await p.click('[data-act="entrar"]');
    await p.waitForTimeout(5200);

    const oscuro = await p.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      hd: getComputedStyle(document.querySelector("body > header")).backgroundColor,
    }));
    check(lum(parse(oscuro.body)) < 0.05, "arranca en oscuro", oscuro.body);

    await p.click("#thm");
    await p.waitForTimeout(1300);

    const claro = await p.evaluate(() => {
      const hd = document.querySelector("body > header");
      const nav = document.querySelector("#nav button[data-act='go']");
      const thm = document.querySelector("#thm");
      const card = document.querySelector(".card, .panel, .tarjeta");
      /* El fondo real no es siempre el del elemento: .card.kpi es
         transparente y hay que subir hasta el primer ancestro con color.
         Leer backgroundColor directo daba negro y un ratio falso de 1,2. */
      const fondoReal = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          if (bg && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(bg)) return bg;
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      return {
        tema: document.body.dataset.theme,
        body: getComputedStyle(document.body).backgroundColor,
        hd: getComputedStyle(hd).backgroundColor,
        hdColor: getComputedStyle(hd).color,
        navColor: nav ? getComputedStyle(nav).color : null,
        thm: getComputedStyle(thm).backgroundColor,
        card: card ? getComputedStyle(card).backgroundColor : null,
        cardBgReal: card ? fondoReal(card) : null,
        cardColor: card ? getComputedStyle(card).color : null,
        ink: getComputedStyle(document.body).getPropertyValue("--ink").trim(),
        // el header no debe mostrar nombres, solo la foto
        nombreVisible: (() => { const e = document.querySelector("#mefn");
          return e ? getComputedStyle(e).display !== "none" : false; })(),
        avatar: !!document.querySelector("#med"),
        // ni links de redes en el header
        redesHeader: document.querySelectorAll(".lb-hd-soc, header a[href*='instagram'], header a[href*='whatsapp']").length,
      };
    });

    check(claro.tema === "light", "el toggle marca light");
    check(lum(parse(claro.body)) > 0.7, "el fondo del panel pasa a claro", claro.body);
    check(lum(parse(claro.hd)) > 0.7, "el header pasa a claro", claro.hd);
    check(/^#?141c26$/i.test(claro.ink), "token --ink redefinido para claro", claro.ink);
    check(claro.thm !== "rgb(255, 255, 255)", "el botón de tema no queda en blanco puro", claro.thm);
    if (claro.cardBgReal) {
      const cb = lum(parse(claro.cardBgReal)), ct = lum(parse(claro.cardColor));
      const r = (Math.max(cb, ct) + 0.05) / (Math.min(cb, ct) + 0.05);
      check(r >= 4.5, "las tarjetas mantienen contraste AA",
        "ratio " + r.toFixed(2) + " sobre " + claro.cardBgReal);
    }
    /* el nav activo no puede quedar tinta oscura sobre tinte claro */
    const navOn = await p.evaluate(() => {
      const el = document.querySelector("#nav button.on") || document.querySelector("#nmenu button.on");
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color };
    });
    if (navOn) {
      const r = (Math.max(lum(parse(navOn.bg)), lum(parse(navOn.fg))) + 0.05) /
                (Math.min(lum(parse(navOn.bg)), lum(parse(navOn.fg))) + 0.05);
      check(r >= 4.5, "el botón activo del nav es legible", "ratio " + r.toFixed(2));
    }
    check(!claro.nombreVisible, "el header no muestra el nombre del usuario");
    check(claro.avatar, "el header conserva la foto de perfil");
    check(claro.redesHeader === 0, "el header no tiene links de redes", String(claro.redesHeader));

    await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "HDCLARO-" + rol + ".png"), clip: { x: 0, y: 0, width: 1440, height: 160 } });

    /* el toggle tiene que ir y volver */
    await p.click("#thm");
    await p.waitForTimeout(1100);
    const vuelta = await p.evaluate(() => ({
      tema: document.body.dataset.theme,
      body: getComputedStyle(document.body).backgroundColor,
    }));
    check(lum(parse(vuelta.body)) < 0.05, "vuelve a oscuro al segundo click", vuelta.body);

    check(errs.length === 0, "sin errores JS" + (errs.length ? ": " + errs[0].slice(0, 90) : ""));
    await ctx.close();
  }

  await b.close();
  console.log("\n=== " + (fallos ? fallos + " FALLAS" : "todo OK") + " ===");
  process.exit(fallos ? 1 : 0);
})();