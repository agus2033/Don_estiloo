/* Sonda manual del lote 49: el SquishSwitch de la LANDING. NO está en
   run.js — necesita el servidor en 8765 y Firebase vivo.
   Verifica el camino real del mouse (page.click = pointerdown/up + click):
   - un clic cambia el tema (body[data-theme]) y NO lo cambia dos veces
     (la clase ssw se traga el click del mouse: detail >= 1); el mismo
     través que ya tengo probado en #thm, ahora en la landing;
   - aria-checked y el transform del knob acompañan el estado;
   - el tema queda en localStorage (peligro de versión vieja: antes el
     fade de íconos no tocaba localStorage en la landing… tocaba: el
     ACT.lbTema siempre lo guardó — misma persistencia, nuevoMontura);
   - y a vuelta de reload el tema agüenta la sensibilidad.
   Uso:  node tests\lbtema-probe.js   (servidor en 8765 requerido) */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });

  let malo = 0;
  const chk = (ok, txt, extra) => {
    console.log((ok ? "  OK    " : "  FALLA ") + txt + (ok ? "" : "  -> " + (extra || "")));
    if (!ok) malo++;
  };

  /* el montaje corre en el post-pintado de R(): si la ficha de barberos
     existe, el switch ya está montado */
  await p.waitForSelector('[data-act="lbFlip"]', { timeout: 25000 });
  const montado = await p.$eval("#lbTema", (el) => el.dataset.ssw === "1" && !!el.querySelector(".ssw-kn"));
  chk(montado, "el switch está montado en la landing (dataset.ssw + knob)");

  const estado = () =>
    p.evaluate(() => ({
      tema: document.body.dataset.theme || "oscuro",
      checked: (document.querySelector("#lbTema") || {}).ariaChecked || document.querySelector("#lbTema").getAttribute("aria-checked"),
      kn: /translateX\(([\d.]+)px\)/.exec((document.querySelector("#lbTema .ssw-kn") || {}).style?.transform || "")?.[1],
    }));

  let e = await estado();
  const arranco = e.tema;
  chk(e.kn !== null, "el knob tiene transform de posición", JSON.stringify(e));

  await p.click("#lbTema");
  await p.waitForTimeout(450); /* el spring del knob tarda ~280 ms */
  e = await estado();
  chk(e.tema !== arranco, "un clic cambia el tema (una sola vez — el mouse no duplica)", arranco + " -> " + e.tema);
  chk((e.tema === "light") === (e.checked === "true"), "aria-checked acompaña el estado", JSON.stringify(e));
  chk((e.tema === "light") === (+e.kn > 10), "el knob acompañó al estado (clara a la derecha)", "kn=" + e.kn);
  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "49-tema-1.png") });

  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-act="lbFlip"]', { timeout: 25000 });
  e = await estado();
  chk(e.tema !== arranco, "al recargar el tema queda (localStorage)", e.tema);

  await p.click("#lbTema");
  await p.waitForTimeout(450);
  e = await estado();
  chk(e.tema === arranco, "el segundo clic vuelve al tema de arranque", e.tema);
  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "49-tema-2.png") });

  await b.close();
  console.log(malo ? "\n=== " + malo + " FALLAS ===" : "\n=== SONDA OK ===");
  process.exit(malo ? 1 : 0);
})();
