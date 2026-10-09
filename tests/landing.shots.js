/* Captura la landing en 390 y 1440, claro y oscuro, por sección.
   Reporta scroll horizontal y errores de consola. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const URL = "http://127.0.0.1:8765/index.html";
const OUT = path.join(__dirname, "tmp_shots");
const SECTIONS = [
  ["hero", "#inicio"],
  ["servicios", "#servicios"],
  ["puntos", "#puntos"],
  ["galeria", "#galeria"],
  ["equipo", "#equipo"],
  ["testimonios", "#testimonios"],
  ["contacto", "#contacto"],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { consola: [], overflow: [], capturas: [], errores: [] };

  for (const [w, h, tag] of [
    [390, 844, "390"],
    [1440, 900, "1440"],
  ]) {
    for (const theme of ["dark", "light"]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 2,
        isMobile: w === 390,
        hasTouch: w === 390,
      });
      const page = await ctx.newPage();
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning")
          report.consola.push(`[${tag}/${theme}] ${m.type()}: ${m.text()}`);
      });
      page.on("pageerror", (e) => report.errores.push(`[${tag}/${theme}] ${e.message}`));

      await page.addInitScript((t) => {
        try { localStorage.setItem("theme", t); } catch (e) {}
      }, theme);

      await page.goto(URL, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".lb", { timeout: 20000 }).catch(() => {
        report.errores.push(`[${tag}/${theme}] no apareció .lb`);
      });
      await page.waitForTimeout(2500);

      // scroll horizontal
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (ov.sw > ov.cw + 1)
        report.overflow.push(`[${tag}/${theme}] scrollWidth ${ov.sw} > ${ov.cw}`);

      const body = await page.evaluate(
        () => document.body.dataset.theme || "(sin data-theme)",
      );
      report.consola.push(`[${tag}/${theme}] data-theme=${body}`);

      for (const [name, sel] of SECTIONS) {
        const el = await page.$(sel);
        if (!el) {
          report.errores.push(`[${tag}/${theme}] falta ${sel}`);
          continue;
        }
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(700);
        const f = path.join(OUT, `${tag}-${theme}-${name}.png`);
        await el.screenshot({ path: f }).catch((e) =>
          report.errores.push(`[${tag}/${theme}/${name}] ${e.message}`),
        );
        report.capturas.push(f);
      }

      // página entera, para ver ritmo y CTA fijo
      const full = path.join(OUT, `${tag}-${theme}-FULL.png`);
      await page.screenshot({ path: full, fullPage: true });
      report.capturas.push(full);

      await ctx.close();
    }
  }

  // flujo del widget + formulario en mobile
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.errores.push(`[widget] ${e.message}`));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".lb-widget");
  await page.waitForTimeout(1200);

  const paso = () =>
    page.evaluate(() => {
      const on = [...document.querySelectorAll(".lb-step-i")].map((e) => e.dataset.on);
      return on.indexOf("0");
    });
  report.consola.push(`[widget] paso inicial=${await paso()}`);

  const svc = await page.$$(".lb-wl");
  if (svc.length) {
    await svc[0].click();
    await page.waitForTimeout(400);
    report.consola.push(`[widget] tras elegir servicio, paso=${await paso()}`);
  }
  const chip = await page.$(".lb-chip:not([disabled])");
  if (chip) {
    await chip.click();
    await page.waitForTimeout(400);
    report.consola.push(`[widget] tras elegir horario, paso=${await paso()}`);
  }
  const w = await page.$("#lbw");
  if (w) await w.screenshot({ path: path.join(OUT, "390-dark-WIDGET.png") });

  // menú móvil
  const b = await page.$("#lbBurg");
  if (b) {
    await b.click();
    await page.waitForTimeout(400);
    const open = await page.getAttribute("#lbBurg", "aria-expanded");
    const hidden = await page.getAttribute("#lbPanel", "hidden");
    report.consola.push(`[menu] aria-expanded=${open} hidden=${hidden}`);
    await page.screenshot({ path: path.join(OUT, "390-dark-MENU.png") });
    await b.click();
  }

  // formulario: error y éxito
  await page.fill("#cf-name", "Test");
  await page.fill("#cf-email", "no-es-un-email");
  await page.fill("#cf-msg", "Hola, quiero un turno.");
  await page.click("#cfSend");
  await page.waitForTimeout(600);
  const st1 = await page.textContent("#cf-status");
  const k1 = await page.getAttribute("#cf-status", "data-k");
  report.consola.push(`[form] tras enviar email inválido: "${st1}" data-k=${k1}`);
  await page.screenshot({ path: path.join(OUT, "390-dark-FORM-ERR.png") });

  // toggle de tema
  const th = await page.$("#lbTema");
  if (th) {
    await th.click();
    await page.waitForTimeout(600);
    report.consola.push(`[tema] tras toggle: ${await page.evaluate(() => document.body.dataset.theme || "(vacío)")}`);
  } else {
    report.errores.push("[tema] no se encontró #lbTema");
  }

  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ consola: report.consola, errores: report.errores, overflow: report.overflow }, null, 2));
  console.log("capturas:", report.capturas.length);
})();
