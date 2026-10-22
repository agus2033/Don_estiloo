/* SquishSwitch (lote 45) contra el módulo REAL (src/ssw.js) y el CSS real.
   Cubre lo que un check de fuente no puede: que el knob camine de a
   verdad, que el drag con vuelta atrás NO cambie el estado, que el flick
   sí cambie por velocidad, y que el teclado (Enter) siga funcionando.
   Manual, no está en run.js.  */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 460, height: 220 } })).newPage();
  /* file:// bloquea ES modules por CORS: el probe va por el 8765 (python
     http.server sobre la raíz del repo; run.js lo enciende, y si no, acá). */
  await p.goto("http://127.0.0.1:8765/tmp/ssw-probe.html");
  await p.waitForFunction(() => !!window.__ssw);
  await p.waitForTimeout(150);

  let malo = 0;
  const chk = (ok, txt, extra) => {
    console.log((ok ? "  OK    " : "  FALLA ") + txt + (ok ? "" : "  -> " + (extra || "")));
    if (!ok) malo++;
  };
  /* posición del knob RELATIVA al botón: dx≈4 = izquierda, dx≈34 = derecha
     (track 64, padding 4, knob 26 -> 64-4-26 = 34). Y el centro del knob,
     para agarrar el drag donde está el dedo. */
  const caja = () =>
    p.evaluate(() => {
      const bt = document.getElementById("thm").getBoundingClientRect(),
        kn = document.querySelector(".ssw-kn").getBoundingClientRect();
      return {
        dx: Math.round(kn.left - bt.left),
        on: document.getElementById("thm").getAttribute("aria-checked"),
        centro: { x: Math.round((kn.left + kn.right) / 2), y: Math.round((kn.top + kn.bottom) / 2) },
      };
    });

  /* 1. arranque: oscuro, knob a la izquierda */
  let d = await caja();
  chk(d.on === "false", "arranque: role=switch con aria-checked=false", d.on);
  chk(d.dx >= 3 && d.dx <= 6, "arranque: el knob arranca a la izquierda", "dx=" + d.dx);

  /* 2. click corto: flip a claro */
  await p.mouse.click(d.centro.x, d.centro.y);
  await p.waitForTimeout(380);
  d = await caja();
  chk(d.on === "true", "click corto: aria-checked=true (claro)", d.on);
  chk(d.dx >= 33 && d.dx <= 35, "click corto: el knob termina a la derecha", "dx=" + d.dx);
  const temaLs = await p.evaluate(() => localStorage.getItem("theme"));
  chk(temaLs === "light", "el caller sincronizó localStorage", temaLs);

  /* 3. drag a la IZQUIERDA desde el knob (que está a la derecha): flip a oscuro */
  await p.mouse.move(d.centro.x, d.centro.y);
  await p.mouse.down();
  for (const nx of [-10, -24, -38]) {
    const c = await caja();
    await p.mouse.move(c.centro.x + nx, c.centro.y, { steps: 2 });
  }
  await p.mouse.up();
  await p.waitForTimeout(420);
  d = await caja();
  chk(d.on === "false", "drag completo a la izquierda: vuelve a oscuro", d.on);

  /* 4. drag que NO cruza la mitad: avanza 9px (supera el umbral de 4 que
     separa click de drag) pero queda bajo el centro: decide por posición.
     Coordenadas absolutas respecto del BOTÓN (el knob viaja, anclarse a él
     acumularía distancias equivocadas). */
  const bx = await p.evaluate(() => document.getElementById("thm").getBoundingClientRect().left);
  await p.mouse.move(bx + 18, d.centro.y);
  await p.mouse.down();
  for (const sx of [3, 8, 10, 9]) {
    await p.mouse.move(bx + 18 + sx, d.centro.y, { steps: 3 });
    await p.waitForTimeout(55);
  }
  await p.mouse.up();
  await p.waitForTimeout(420);
  d = await caja();
  chk(d.on === "false", "drag corto que no cruza la mitad: estado sin cambio", d.on);

  /* 5. flick RÁPIDO a la derecha: cambia por velocidad, no por distancia */
  await p.mouse.move(bx + 18, d.centro.y);
  await p.mouse.down();
  await p.mouse.move(bx + 38, d.centro.y, { steps: 1 });
  await p.mouse.move(bx + 73, d.centro.y, { steps: 1 });
  await p.mouse.up();
  await p.waitForTimeout(450);
  d = await caja();
  chk(d.on === "true", "flick rápido a la derecha: cambia (velocity > umbral)", d.on);

  /* 6. teclado: Enter en un button role=switch => flip a oscuro */
  await p.focus("#thm");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);
  d = await caja();
  chk(d.on === "false", "teclado: Enter flipea (true -> false)", d.on);

  /* 7. teclado de nuevo -> flip a claro (y queda, porque el click nunca
     llegó por el camino del mouse) */
  await p.keyboard.press(" ");
  await p.waitForTimeout(400);
  d = await caja();
  chk(d.on === "true", "teclado: Espacio flipea (false -> true)", d.on);

  /* captura en ambos estados */
  await p.evaluate(() => window.__ssw.set(true));
  await p.waitForTimeout(420);
  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "45-ssw-claro.png") });
  await p.evaluate(() => window.__ssw.set(false));
  await p.waitForTimeout(420);
  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "45-ssw-oscuro.png") });

  await b.close();
  console.log(malo ? "\n=== " + malo + " FALLAS ===" : "\n=== SSW MECANICA COMPLETA ===");
  process.exit(malo ? 1 : 0);
})();
