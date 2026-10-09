/* Recorre el asistente de 6 pasos y reporta el estado real de cada uno. */
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright");

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/firestore/i.test(m.text())) errs.push("console: " + m.text()); });

  const paso = () => p.evaluate(() => {
    const on = document.querySelector(".wz-paso.on");
    return { n: on ? +on.querySelector("b").textContent : -1, txt: on ? on.textContent.trim() : null,
             pie: document.querySelector(".wz-pie .wz-btn--pri")?.textContent.trim(),
             listo: !document.querySelector(".wz-pie .wz-btn--pri")?.disabled };
  });

  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard"); await p.waitForTimeout(1500);

  console.log("hero tiene tarjeta:", await p.$$eval(".lb-wcard", (e) => e.length));
  await p.click('[data-act="wzAbrir"]');
  await p.waitForTimeout(500);
  console.log("modal abierto:", await p.isVisible("#wzm"), "| dialog:", await p.isVisible(".wz-sheet"));
  console.log("paso 1:", JSON.stringify(await paso()));

  // 1 servicio
  const svcs = await p.$$(".wz-item");
  console.log("servicios:", svcs.length);
  if (svcs.length) { await svcs[0].click(); await p.waitForTimeout(250); }
  console.log("  con servicio, listo:", (await paso()).listo);
  await p.click(".wz-pie .wz-btn--pri"); await p.waitForTimeout(350);
  console.log("paso 2:", JSON.stringify(await paso()));

  // 2 barbero
  const bars = await p.$$(".wz-item");
  console.log("barberos:", bars.length);
  if (bars.length) { await bars[0].click(); await p.waitForTimeout(250); }
  await p.click(".wz-pie .wz-btn--pri"); await p.waitForTimeout(1400);
  console.log("paso 3:", JSON.stringify(await paso()));

  // 3 calendario
  const cal = await p.evaluate(() => {
    const c = [...document.querySelectorAll(".wz-cel")].filter((x) => !x.classList.contains("vacia"));
    const cuenta = (k) => c.filter((x) => x.classList.contains(k)).length;
    return { dias: c.length, libre: cuenta("libre"), completo: cuenta("completo"),
      cerrado: cuenta("cerrado"), pasado: cuenta("pasado"),
      deshabilitados: c.filter((x) => x.disabled).length,
      leyenda: [...document.querySelectorAll(".wz-leyenda .p")].map((x) => x.textContent),
      aviso: document.querySelector(".wz-aviso")?.textContent.trim() || null };
  });
  console.log("calendario:", JSON.stringify(cal));
  const wiz = await p.$("#wiz"); await wiz.screenshot({ path: "tmp_shots/WZ-3-calendario.png" });

  const libre = await p.$(".wz-cel.libre:not(.on)");
  if (libre) { await libre.click(); await p.waitForTimeout(300); }
  await p.click(".wz-pie .wz-btn--pri"); await p.waitForTimeout(400);
  console.log("paso 4:", JSON.stringify(await paso()));
  console.log("turnos:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".wz-turno")].map((t) => ({
    txt: t.querySelector("b").textContent, rango: t.querySelector("small").textContent,
    n: t.querySelector("em").textContent, off: t.classList.contains("off"), disabled: t.disabled })))));
  const w4 = await p.$("#wiz"); await w4.screenshot({ path: "tmp_shots/WZ-4-turno.png" });

  const turnoOn = await p.$(".wz-turno:not(.off)");
  if (turnoOn) { await turnoOn.click(); await p.waitForTimeout(300); }
  await p.click(".wz-pie .wz-btn--pri"); await p.waitForTimeout(400);
  console.log("paso 5:", JSON.stringify(await paso()));
  console.log("horas:", JSON.stringify(await p.evaluate(() => ({
    n: document.querySelectorAll(".wz-hora").length,
    opacos: [...document.querySelectorAll(".wz-hora")].filter((h) => h.disabled).length,
    nota: document.querySelector(".wz-ocupadas")?.textContent.trim() }))));
  const w5 = await p.$("#wiz"); await w5.screenshot({ path: "tmp_shots/WZ-5-horas.png" });

  const hora = await p.$(".wz-hora:not([disabled])");
  if (hora) { await hora.click(); await p.waitForTimeout(250); }
  await p.click(".wz-pie .wz-btn--pri"); await p.waitForTimeout(400);
  console.log("paso 6:", JSON.stringify(await paso()));
  console.log("resumen:", JSON.stringify(await p.evaluate(() => ({
    filas: [...document.querySelectorAll(".wz-sum div")].map((d) => d.querySelector("span").textContent + ": " + d.querySelector("b").textContent),
    cta: [...document.querySelectorAll(".wz-body .wz-btn")].map((x) => x.textContent.trim()),
    aviso: document.querySelector(".wz-body .wz-aviso")?.textContent.trim() || null }))));
  const w6 = await p.$("#wiz"); await w6.screenshot({ path: "tmp_shots/WZ-6-resumen.png" });

  // gate de login
  await p.click(".wz-body .wz-btn--pri"); await p.waitForTimeout(700);
  console.log("tras Ingresar y confirmar:", JSON.stringify(await p.evaluate(() => ({
    hash: location.hash, login: !!document.querySelector("#ingresar:not([hidden])") }))));

  // cerrar
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard"); await p.waitForTimeout(1200);
  await p.click('[data-act="wzAbrir"]'); await p.waitForTimeout(400);
  await p.click('[data-act="wzCerrar"]'); await p.waitForTimeout(300);
  console.log("modal cerrado:", !(await p.isVisible(".wz-sheet")));

  console.log("errores:", JSON.stringify(errs));
  await ctx.close(); await b.close();
})();
