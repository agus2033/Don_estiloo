/* La foto del barbero en la landing, contra el sitio REAL y con los datos
   REALES.

   Por qué esta prueba existe y por qué es de este tipo:

   El bug que outlets era que el snapshot de `fotoBarbero` guardaba
   `FOTOS[d.id] = d.data().foto` (una cadena) mientras que `conFotos()` esperaba
   el documento entero (un objeto). Al extender una cadena con `...pub` se
   parten los caracteres, `pub.foto` queda `undefined`, y la tarjeta cae al
   respaldo `foto: ""` y muestra "[Foto]".

   ¿Por qué no lo agarró ninguna prueba? Porque la del merge (`setFotos`)
   pasaba a mano la forma que el CONSUMIDOR espera. O sea: la prueba se
   comprobaba a sí misma. Armar el objeto a mano nunca puede revelar un
   desacuerdo entre el que produce y el que consume.

   Esta prueba no arma nada: carga el sitio publicado y mira lo que un
   visitante sin sesión ve de verdad.

   Requiere red. node tests\landing.foto.viva.js
*/
const { chromium } = require("../.opencode/skills/playwright-skill/node_modules/playwright/index.js");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "https://codigobarber.com.ar/";
const cfg = fs.readFileSync(path.join(__dirname, "..", "src", "config.js"), "utf8");
const API = (cfg.match(/apiKey:\s*"([^"]+)"/) || [])[1];
const PROY = (cfg.match(/projectId:\s*"([^"]+)"/) || [])[1];

let fallos = 0;
const ok = (c, m, d) => {
  console.log((c ? "  OK    " : "  FALLA ") + m);
  if (!c) {
    fallos++;
    if (d) console.log("          " + d);
  }
};

(async () => {
  console.log("=== sitio: " + BASE + " ===");

  /* Qué hay de verdad en la base, sin sesion. Si la colección está vacía no
     hay nada que comprobar y la prueba lo dice en vez de dar verde. */
  const base = `https://firestore.googleapis.com/v1/projects/${PROY}/databases/(default)/documents`;
  const fb = await fetch(`${base}/fotoBarbero?key=${API}`);
  const fbj = await fb.json().catch(() => ({}));
  const docs = fbj.documents || [];
  console.log("  fotoBarbero: HTTP " + fb.status + " · " + docs.length + " documento(s)");
  docs.forEach((d) => console.log("    " + d.name.split("/").pop() + " -> " + String((d.fields || {}).foto?.stringValue || "").slice(0, 70)));

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const jsErr = [];
  page.on("pageerror", (e) => jsErr.push(String(e).slice(0, 130)));
  const malas = [];
  page.on("response", (r) => {
    if (/firestore\.googleapis|cloudinary/.test(r.url()) && r.status() >= 400) malas.push(r.status() + " " + r.url().slice(0, 70));
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#equipo", { timeout: 45000, state: "attached" });
  await page.waitForTimeout(9000);

  const r = await page.evaluate(async () => {
    const tarjetas = [...document.querySelectorAll("#equipo .lb-barber")];
    if (!tarjetas.length) return { error: "no hay tarjetas de equipo" };
    const img = tarjetas[0].querySelector("img");
    if (img && !img.complete) await new Promise((res) => { img.onload = img.onerror = res; setTimeout(res, 9000); });
    return {
      tarjetas: tarjetas.length,
      texto: tarjetas[0].innerText.replace(/\n+/g, " | ").slice(0, 70),
      tieneImg: !!img,
      natural: img ? img.naturalWidth : 0,
      src: img ? img.getAttribute("src").slice(0, 80) : "(ninguna)",
      pintado: img ? Math.round(img.getBoundingClientRect().width) + "x" + Math.round(img.getBoundingClientRect().height) : "-",
      falta: tarjetas[0].innerText.includes("[Foto]"),
    };
  });

  console.log("  tarjeta: " + r.tarjetas + "  (" + r.texto + ")");
  if (r.error) {
    ok(false, r.error);
  } else {
    ok(!r.falta, "la tarjeta NO muestra el cartel [Foto]", r.texto);
    ok(r.tieneImg, "la tarjeta tiene un <img>", "hay " + r.tarjetas + " tarjeta(s) y ninguna trae imagen");
    ok(r.natural > 0, "y la imagen se descargó de verdad", "naturalWidth = " + r.natural);
    ok(r.pintado !== "0x0", "y se pinta con tamaño", r.pintado);
    ok(/res\.cloudinary\.com/.test(r.src || ""), "apunta a la foto de Cloudinary", r.src);
  }
  ok(jsErr.length === 0, "sin errores de JS", jsErr.join(" | "));
  ok(malas.length === 0, "sin respuestas 4xx/5xx a Firebase o Cloudinary", malas.join(" | "));

  await b.close();
  console.log(fallos ? `\nFALLARON ${fallos}` : "\nTODO VERDE");
  process.exit(fallos ? 1 : 0);
})();