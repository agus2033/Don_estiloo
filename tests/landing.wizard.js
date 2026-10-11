/* Recorre el asistente de 6 pasos y reporta el estado real de cada uno.

   Corre a 390 px a propósito: en el celular el asistente AVANZA SOLO al
   elegir (lo pidió el dueño), así que no hay botón de "continuar" y este
   test recorre el flujo tocando opciones, no botones. Antes clickeaba
   `.wz-pie .wz-btn--pri` en cada paso y crasheaba con timeout de 30 s al
   desaparecer ese botón. */
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
    return {
      n: on ? +on.querySelector("b").textContent : -1,
      txt: on ? on.textContent.trim() : null,
      pie: document.querySelector(".wz-pie .wz-btn--pri")?.textContent.trim() || null,
      hayBotonContinuar: !!document.querySelector(".wz-pie .wz-btn--pri"),
      hayAtras: !!document.querySelector('.wz-pie [data-act="wzBack"]'),
    };
  });
  /* Espera a que el paso sea N, en vez de dormir una cantidad fija: el salto
     automático tiene 280 ms de retardo y los esperas fijos fallaban. */
  const esperarPaso = async (n) => {
    for (let i = 0; i < 40; i++) {
      const s = await paso();
      if (s.n === n) return s;
      await p.waitForTimeout(150);
    }
    return paso();
  };

  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-wcard"); await p.waitForTimeout(1500);

  console.log("hero tiene tarjeta:", await p.$$eval(".lb-wcard", (e) => e.length));
  await p.click('[data-act="wzAbrir"]');
  await p.waitForTimeout(500);
  console.log("modal abierto:", await p.isVisible("#wzm"), "| dialog:", await p.isVisible(".wz-sheet"));
  const p1 = await paso();
  console.log("paso 1:", JSON.stringify(p1));
  /* El comportamiento nuevo, fijado acá para que no se rompa en silencio */
  console.log("  celular SIN boton de continuar:", !p1.hayBotonContinuar ? "OK" : "FALLA");
  console.log("  celular SIN boton atras en el paso 1:", !p1.hayAtras ? "OK" : "FALLA");

  // 1 servicio -> avanza solo
  const svcs = await p.$$(".wz-item");
  console.log("servicios:", svcs.length);
  if (svcs.length) await svcs[0].click();
  console.log("paso 2 (auto):", JSON.stringify(await esperarPaso(2)));

  // 2 barbero -> avanza solo
  const bars = await p.$$(".wz-item");
  console.log("barberos:", bars.length);
  if (bars.length) await bars[0].click();
  console.log("paso 3 (auto):", JSON.stringify(await esperarPaso(3)));

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
  if (libre) await libre.click();
  console.log("paso 4 (auto):", JSON.stringify(await esperarPaso(4)));
  console.log("turnos:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".wz-turno")].map((t) => ({
    txt: t.querySelector("b").textContent, rango: t.querySelector("small").textContent,
    n: t.querySelector("em").textContent, off: t.classList.contains("off"), disabled: t.disabled })))));
  const w4 = await p.$("#wiz"); await w4.screenshot({ path: "tmp_shots/WZ-4-turno.png" });

  const turnoOn = await p.$(".wz-turno:not(.off)");
  if (turnoOn) await turnoOn.click();
  console.log("paso 5 (auto):", JSON.stringify(await esperarPaso(5)));
  console.log("horas:", JSON.stringify(await p.evaluate(() => ({
    n: document.querySelectorAll(".wz-hora").length,
    opacos: [...document.querySelectorAll(".wz-hora")].filter((h) => h.disabled).length,
    nota: document.querySelector(".wz-ocupadas")?.textContent.trim() }))));
  const w5 = await p.$("#wiz"); await w5.screenshot({ path: "tmp_shots/WZ-5-horas.png" });

  /* "Atrás" tiene que seguir funcionando y no quedar un salto automático
     pendiente que teletransporte al usuario de vuelta al resumen. */
  const hora = await p.$(".wz-hora:not([disabled])");
  if (hora) await hora.click();
  const p6 = await esperarPaso(6);
  console.log("paso 6 (auto desde el horario):", JSON.stringify(p6));
  console.log("  vuelve al resumen solo:", p6.n === 6 ? "OK" : "FALLA");

  console.log("resumen:", JSON.stringify(await p.evaluate(() => ({
    titulo: document.querySelector(".wz-res-tit")?.textContent.trim() || null,
    filas: [...document.querySelectorAll(".wz-rf")].map((d) => {
      const etq = d.querySelector(".wz-rf-t > span").textContent.trim();
      const val = d.querySelector(".wz-rf-t b").textContent.trim();
      const camb = d.querySelector(".wz-rf-c");
      return etq + ": " + val + " [Cambiar -> paso " + (camb ? camb.dataset.args : "?") + "]";
    }),
    precio: document.querySelector(".wz-res-precio b")?.textContent.trim() || null,
    politica: document.querySelector(".wz-pol")?.textContent.trim() || null,
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