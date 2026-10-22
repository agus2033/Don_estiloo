/* Sonda manual del lote 48 (horarios libres que pre-cargan la reserva).
   NO está en run.js: necesita el servidor local en 8765 y Firebase vivo.

   Prueba el camino ANÓNIMO (modal de la landing), que usa exactamente el
   mismo código que el camino del panel (libreRes -> lbAbreReserva ->
   wzS -> wzFaltante). El widget del Inicio no puede verse sin sesión de
   cliente (no hay cuenta de cliente desbloqueada para pruebas — ver
   PRODUCT.md §48), así que el chip se simula inyectando un botón
   data-act="libreRes" con data-args reales; el dispatcher (dRun) lo lee
   igual que un chip real.

   Dos chips inyectados y lo que DEBE pasar con cada uno:
   - "07:37" (fuera de toda grilla): elegir el servicio tiene que CAER la
     hora y aterrizar en el paso 4 (turno): día+barbero sobreviven, hora no.
   - "09:00" (on-grid temprano): si sigue libre en la base real, aterriza
     directo en el RESUMEN (paso 6); si la base la tiene ocupada, cae al
     paso 4 igual que la otra. Ambos destinos son honestos: el inválido
     SIEMPRE llega a 4, el válido a 4 o 6.

   Tras cada aterrizaje se prueba "poder volver" (Atrás de a un paso) y
   que la fecha de hoy quedó marcada en el calendario.
   Uso:  node tests\libres-probe.js   (servidor en 8765 requerido) */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const toca = async (p, sel) => p.$eval(sel, (el) => el.click());

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });

  let malo = 0;
  const chk = (ok, txt, extra) => {
    console.log((ok ? "  OK    " : "  FALLA ") + txt + (ok ? "" : "  -> " + (extra || "")));
    if (!ok) malo++;
  };

  /* datos vivos: las fichas de barberos (lbFlip) sólo existen cuando ya
     llegaron los datos — es la señal de "listo para reservar". */
  await p.waitForSelector('[data-act="lbFlip"]', { timeout: 25000 });
  await p.waitForTimeout(2000); // la foto del mes (occ) suele tardar 1-2 s más

  const bid = await p.$eval('[data-act="lbFlip"]', (el) => JSON.parse(el.dataset.args)[0] || "");
  chk(!!bid, "un id de barbero real sale de la primera ficha", bid || "ninguno");

  /* --- chip 1: hora fuera de toda grilla --- */
  /* El botón va DENTRO del body antes del click: el delegador escucha en el
     documento, y un botón huérfano (createElement sin append) no burbujea. */
  await p.evaluate((id) => {
    const btn = document.createElement("button");
    btn.dataset.act = "libreRes";
    btn.dataset.args = JSON.stringify([id, "07:37"]);
    document.body.appendChild(btn);
    btn.click();
    btn.remove();
  }, bid);
  await p.waitForSelector("#wzm:not([hidden]) #wiz", { timeout: 15000 });
  await p.waitForTimeout(400);
  const paso1 = await p.evaluate(() =>
    [...document.querySelectorAll(".wz-paso")].map((x) => (x.classList.contains("on") ? "on" : "  ") + (x.querySelector("b") || {}).textContent),
  );
  chk(paso1.some((x) => x === "on1"), "la pre-carga abre en el PASO 1 (el servicio falta: sel.s = -1)", JSON.stringify(paso1));

  await toca(p, '[data-act="wzS"]');
  await p.waitForTimeout(700); /* 280 ms de auto-avance + repintado */
  let r1 = await p.evaluate(() => (document.querySelector(".wz-paso.on b") || {}).textContent);
  chk(r1 === "4", "hora fuera de grilla + servicio elegido -> aterriza en el paso 4 (turno)", "paso " + r1);

  /* poder volver: de 4 a 3 y en 3 la fecha de hoy sigue marcada */
  await toca(p, '[data-act="wzBack"]');
  await p.waitForTimeout(250);
  r1 = await p.evaluate(() => (document.querySelector(".wz-paso.on b") || {}).textContent);
  chk(r1 === "3", "Atrás desde el 4 cae en el 3 (lineal, sin saltos para atrás)", r1);
  const hoy = String(new Date().getDate());
  const marca = await p.evaluate(() => {
    const on = document.querySelector('.wz-cal .wz-cel[aria-pressed="true"]');
    return on ? (on.textContent || "").trim() : "";
  });
  chk(marca === hoy, "el calendario marca el día de HOY (la pre-carga sobrevivió al viaje)", marca || "nada marcado");

  /* --- chip 2: hora on-grid temprana --- */
  await p.evaluate(() => {
    const btn = document.querySelector("[data-act='wzCerrar']");
    if (btn) btn.click();
  });
  await p.waitForTimeout(300);
  await p.evaluate((id) => {
    const btn = document.createElement("button");
    btn.dataset.act = "libreRes";
    btn.dataset.args = JSON.stringify([id, "09:00"]);
    document.body.appendChild(btn);
    btn.click();
    btn.remove();
  }, bid);
  await p.waitForSelector("#wzm:not([hidden]) #wiz", { timeout: 15000 });
  await p.waitForTimeout(400);
  await toca(p, '[data-act="wzS"]');
  await p.waitForTimeout(700);
  const r2 = await p.evaluate(() => (document.querySelector(".wz-paso.on b") || {}).textContent);
  chk(r2 === "6" || r2 === "4", "hora on-grid: cae en el RESUMEN (libre) o en el 4 (ocupada) — ambos honestos", "paso " + r2);
  if (r2 === "6") {
    const txt = await p.evaluate(() => (document.querySelector("#wzm .wz-body") || {}).textContent);
    chk(/Revis|Resumen|Confirmar|resumen/.test(txt), "llegó al resumen con todo pre-cargado", txt.slice(0, 140));
    await p.evaluate(() => {
      const filas = [...document.querySelectorAll('[data-act="wzIr"]')];
      const h = filas.find((x) => {
        try {
          return JSON.parse(x.dataset.args)[0] === 5;
        } catch (_) {
          return false;
        }
      });
      if (h) h.click();
    });
    await p.waitForTimeout(350);
    const paso5 = await p.evaluate(() => (document.querySelector(".wz-paso.on b") || {}).textContent);
    chk(paso5 === "5", "del resumen se puede saltar a la grilla de horarios (Cambiar)", paso5);
    const on5 = await p.evaluate(() => {
      const on = document.querySelector(".wz-hora.on");
      return on ? (on.textContent || "").trim() : "";
    });
    chk(on5 === "09:00", "la grilla del paso 5 tiene la hora pre-cargada marcada", on5 || "nada marcado");
  }

  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "48-libres-probe.png") });
  await b.close();
  console.log(malo ? "\n=== " + malo + " FALLAS ===" : "\n=== SONDA OK ===");
  process.exit(malo ? 1 : 0);
})();
