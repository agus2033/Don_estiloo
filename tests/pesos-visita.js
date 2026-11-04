/* Lote 53: un visitante REAL de navegador, de a uno, mide lo que el piloto
   HTTP no puede ver (el piloto no ejecuta JS): cuántas imágenes transforma
   Cloudinary, cuánto pesa la visita y qué endpoints de Firebase toca la
   landing anónima. Con esos números se estima lo que pasaría con 1000
   usuarios reales en día normal.

   Uso:  node tests\pesos-visita.js   (requiere el 8765 arriba)
   NO va en run.js. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");

(async () => {
  const porEnv = {};
  let okn = 0;
  const ok = (c, m, e) => {
    if (c) {
      okn++;
      console.log("  OK    " + m);
    } else {
      console.log("  FALLA " + m + (e ? "  -> " + e : ""));
      process.exitCode = 1;
    }
  };
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const pide = [];
  p.on("request", (rq) => {
    const u = new URL(rq.url());
    const env = u.hostname
      .replace(/^(www|res)\./, "")
      .replace(/\.googleapis\.com$/, "")
      .replace(/\.gstatic\.com$/, "")
      .replace(/\.firebaseapp\.com$/, "")
      .replace(/\.firebasestorage\.app$/, "");
    pide.push({ host: env, path: u.pathname.slice(0, 60), tipo: rq.resourceType(), metodo: rq.method() });
  });
  // bytes descargados por response (headers + body)
  let bajados = 0;
  p.on("response", (rs) => {
    rs.body()
      .then((t) => {
        bajados += t.length;
      })
      .catch(() => {});
  });

  const t0 = Date.now();
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "domcontentloaded", timeout: 45000 });
  /* La landing nunca abre el asistente sola: hay que tocar "Reservar
     ahora" (igual que un visitante). Hay cuatro (encabezado, banda, etc.);
     en celular no todos se ven — se toca el primero visible. La app a veces
     re-pinta o recarga justo acá (service worker) y destruye el contexto
     de evaluate: se reintenta. El reloj termina cuando el paso 1 lista
     servicios, lo último que llega de Firestore. */
  await p.waitForFunction(() => document.querySelectorAll('[data-act="lbReservar"]').length > 2, { timeout: 30000 });
  let toco = false;
  for (let i = 0; i < 6 && !toco; i++) {
    try {
      toco = await p.evaluate(() => {
        const b = [...document.querySelectorAll('[data-act="lbReservar"]')].find((x) => x.getClientRects().length);
        if (b) b.click();
        return !!b;
      });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!toco) throw new Error("no se pudo tocar Reservar ahora");
  /* El asistente abre una pantalla de intro con "ELEGIR MI TURNO"; el paso 1
     (lista de servicios) aparece recién después de tocar ese botón. */
  let elegi = false;
  for (let i = 0; i < 6 && !elegi; i++) {
    try {
      elegi = await p.evaluate(() => {
        const bn = [...document.querySelectorAll("button")].find(
          (x) => /ELEGIR MI TURNO/i.test(x.innerText) && x.getClientRects().length,
        );
        if (bn) bn.click();
        return !!bn;
      });
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!elegi) throw new Error("no se pudo tocar ELEGIR MI TURNO");
  await p.waitForSelector(".wz-item--svc", { timeout: 45000 });
  const tle = Date.now() - t0;
  /* La visita sigue: la galería (Cloudinary) pinta unos segundos después.
     No se puede usar networkidle (Firestore mantiene canales abiertos para
     siempre): se deja una cola fija de 8 s para contar la visita completa. */
  await p.waitForTimeout(8000);

  const conteo = {};
  pide.forEach((x) => (conteo[x.host] = (conteo[x.host] || 0) + 1));
  const cl = pide.filter((x) => /cloudinary/.test(x.host));
  const fb = pide.filter((x) => /firestore|firebase|gstatic/.test(x.host));

  console.log("demora hasta el paso 1 del asistente listo:", (tle / 1000).toFixed(1), "s");
  console.log("requests por host:", JSON.stringify(conteo, null, 2));
  console.log("Cloudinary:", cl.length, "pedidos");
  console.log("Firebase (streams + SDK):", fb.length, "pedidos");
  console.log("peso total de la visita:", (bajados / 1024).toFixed(0), "KB");

  ok(cl.length > 0, "hay fotos de Cloudinary (galería viva)");
  ok(fb.length > 0, "hay pedidos/streams de Firebase");
  ok(tle < 12000, "el paso 1 del asistente está listo antes de 12 s en red local", (tle / 1000).toFixed(1) + "s");

  fs.writeFileSync(
    path.join(__dirname, "..", "tmp_shots", "visita.json"),
    JSON.stringify(
      { fecha: new Date().toISOString(), demoraMs: tle, conteo, cloudinary: cl.length, firebase: fb.length, pesoKb: Math.round(bajados / 1024), nota: "conteo incluye 8 s de descanso" },
      null,
      2,
    ),
  );
  await b.close();
  console.log("");
  console.log(`${process.exitCode ? "HAY FALLAS" : "TODO VERDE"} — ${okn} checks`);
})();
