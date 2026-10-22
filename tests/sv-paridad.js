/* Paridad de tarjetas de servicios (lote 47): en el fixture con landing.css
   real, las tres variantes (con foto, con hueco "Sin foto", con hueco y sin
   descripción) deben alinear títulos y pies a la misma altura. Manual, no
   está en run.js. */
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1040, height: 760 } })).newPage();
  await p.goto("http://127.0.0.1:8765/tmp/sv-probe.html", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lb-sv", { state: "visible", timeout: 15000 });
  await p.waitForTimeout(300);

  let malo = 0;
  const chk = (ok, txt, extra) => {
    console.log((ok ? "  OK    " : "  FALLA ") + txt + (ok ? "" : "  -> " + (extra || "")));
    if (!ok) malo++;
  };

  const d = await p.evaluate(() => {
    const cards = [...document.querySelectorAll(".lb-sv")];
    const acc = (sel) => cards.map((c) => { const e = c.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top) : null; });
    return {
      algos: acc(".lb-sv-img"),
      fotos: acc(".lb-sv-falta"),
      tops: acc("h3"),
      pies: acc(".lb-sv-ft"),
    };
  });
  /* tolerancia de 1px: en columnas de 313.33px la fracción vertical de un
     <img> vs un <span> redondea a medio pixel y el Math.round puede diferir
     en 1. No lo ve ningún ojo humano. */
  const cerca = (a) => a.every((x) => x != null && Math.abs(x - a[0]) <= 1);
  chk(cerca(d.algos.filter((x) => x !== null)) || iguales(d.algos), "la franja de imagen mide igual en las 3", JSON.stringify(d.algos));
  chk(d.fotos.filter((x) => x !== null).length === 2, "dos tarjetas declaran el hueco Sin foto", JSON.stringify(d.fotos));
  chk(cerca(d.tops), "los títulos arrancan a la misma altura", JSON.stringify(d.tops));
  chk(cerca(d.pies), "los pies (duración/precio) quedan a la misma altura", JSON.stringify(d.pies));

  await p.screenshot({ path: path.join(__dirname, "..", "tmp_shots", "47-paridad.png") });
  await b.close();
  console.log(malo ? "\n=== " + malo + " FALLAS ===" : "\n=== PARIDAD OK ===");
  process.exit(malo ? 1 : 0);
})();
