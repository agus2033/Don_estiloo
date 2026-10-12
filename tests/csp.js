/* Comprueba la CSP contra la web real: la levanta con las cabeceras de
   producción (tests/srv.js) y anota TODO lo que el navegador bloquea.

   No alcanza con mirar que la página carga: la CSP bloquea en silencio. Un
   `style=` descartado, una fuente que no aparece o un iframe que no se dibuja
   no tiran ningún error en consola, se ven solamente.

   Uso:  node tests\csp.js [url]
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

const URL = process.argv[2] || "http://127.0.0.1:8766/index.html";

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK   " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("         " + d);
  }
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();

  /* Todo lo que la CSP para: sale por el canal de "securitypolicyviolation". */
  const violaciones = [];
  await ctx.addInitScript(() => {
    window.__viol = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__viol.push({
        tipo: e.violatedDirective,
        bloqueado: (e.blockedURI || "").slice(0, 70),
        linea: e.lineNumber,
      });
    });
  });

  const errores = [];
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/favicon/i.test(t)) errores.push(t.slice(0, 140));
  });
  page.on("pageerror", (e) => errores.push("pageerror: " + String(e).slice(0, 140)));

  /* Las peticiones que no terminan bien: sin esto, el error de consola dice
     "MIME type text/html" pero no cuál URL lo pidió, y hay que adivinar. */
  const rotas = [];
  page.on("requestfailed", (r) =>
    rotas.push((r.failure() && r.failure().errorText) + "  " + r.url().slice(0, 90)),
  );
  page.on("response", (r) => {
    if (r.status() >= 400 || (r.url().includes("fonts.googleapis") && r.status() !== 200))
      rotas.push("HTTP " + r.status() + "  " + r.url().slice(0, 90));
  });

  console.log("CSP contra la web real\n  " + URL + "\n");

  await page.goto(URL, { waitUntil: "domcontentloaded" }).catch((e) => console.log("  goto: " + e.message.slice(0, 80)));
  /* No se aborta si la landing no aparece: con una CSP equivocada NO aparece,
     que es justamente el dato que hace falta. Se sigue midiendo. */
  const vino = await page
    .waitForSelector(".lb-wcard", { timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(3500);

  const v = await page.evaluate(() => window.__viol || []);
  console.log("la landing apareció: " + (vino ? "sí" : "NO"));
  console.log("violaciones de CSP: " + v.length);
  for (const x of v.slice(0, 12)) {
    console.log("    " + x.tipo + "  ->  " + x.bloqueado);
  }
  if (errores.length) {
    console.log("\nerrores de consola:");
    for (const e of errores.slice(0, 8)) console.log("    " + e);
  }
  if (rotas.length) {
    console.log("\npeticiones que no salieron bien:");
    for (const e of rotas.slice(0, 10)) console.log("    " + e);
  }

  ok(vino, "la landing se dibuja con la CSP puesta");

  /* --- la página se ve bien --- */
  const vis = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const estilo = (el) => (el ? getComputedStyle(el) : null);
    const h1 = q("h1, .lb-h1, .lb-hero h2");
    const btn = q(".lb-btn, button.lb-btn, .boton");
    const carta = q(".lb-wcard");
    const img = q(".lb-sv-img, .lb-wcard img, img");
    return {
      /* Si la CSP hubiera tirado los estilos, los botones no tendrían fondo
         ni tamaño: se leen vacíos. */
      btn: btn ? { bg: estilo(btn).backgroundColor, h: btn.offsetHeight, txt: btn.textContent.trim().slice(0, 20) } : null,
      h1: h1 ? { txt: h1.textContent.trim().slice(0, 30), size: estilo(h1).fontSize } : null,
      carta: carta ? { w: carta.offsetWidth, h: carta.offsetHeight } : null,
      img: img ? { w: img.naturalWidth, h: img.naturalHeight, visible: !!img.offsetParent } : null,
      inlineVivo: q(".lb-btn") ? estilo(q(".lb-btn")).cssText.length : 0,
      bodyFont: estilo(document.body).fontFamily.slice(0, 40),
    };
  });
  console.log("\n" + JSON.stringify(vis, null, 1).split("\n").join("\n  "));

  ok(!!vis.btn && vis.btn.h > 20, "los botones tienen alto (los estilos inline no se descartaron)", JSON.stringify(vis.btn));
  ok(!!vis.h1 && vis.h1.size !== "16px", "el título tiene tamaño de título", JSON.stringify(vis.h1));
  ok(!!vis.carta && vis.carta.w > 200, "las tarjetas tienen ancho");
  ok(v.length === 0, "ninguna violación de CSP en la carga", JSON.stringify(v.slice(0, 3)));

  /* --- el panel: la parte que más estilos inline genera --- */
  console.log("\n--- paneles (usuario anonimo: no hay login sin cuenta) ---");
  console.log("  se omite: los paneles necesitan una cuenta de prueba que no existe");

  await b.close();
  console.log(fallos ? "\nFALLARON " + fallos : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();