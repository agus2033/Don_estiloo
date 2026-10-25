/* Lote 51: el título de Google dice "Barbería en Puerto Iguazú" (pedido del
   dueño: "quiero que sea SSJ Barber | Barberia en Puerto Iguazu en google").

   Lo que se arregla acá NO es sólo el <title> del index.html: la app hacía
   `document.title = NOMBRE` en CADA pintado de R() (main.js), así que en el
   navegador la pestaña terminaba en "SSJ Barber" pelado y el título largo
   del HTML duraba hasta el primer repintado. Ahora el título sale de UNA
   sola fuente, TITULO en config.js, y el HTML tiene que decir exactamente
   lo mismo.

   Este test vigila las dos mitades:
     - config.js define TITULO con el texto pedido;
     - index.html (<title>, og:title, twitter:title) dice EXACTAMENTE eso;
     - main.js asigna TITULO y ya no NOMBRE;
     - la marca (JSON-LD name, manifest) sigue siendo "SSJ Barber" sin tilde;
     - el título sigue entrando en Google y arranca con la marca.

   Uso:  node tests\lote51.js
   En run.js: fila 'lote51' (después de 'lote50'). */
const fs = require("fs");
const path = require("path");

let okn = 0;
const ok = (cond, msg, extra) => {
  if (cond) {
    okn++;
    console.log("  OK    " + msg);
  } else {
    console.log("  FALLA " + msg + (extra ? "  -> " + extra : ""));
    process.exitCode = 1;
  }
};
const lee = (f) => {
  try {
    return fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  } catch (e) {
    return "";
  }
};

const cf = lee("src/config.js");
const mj = lee("src/main.js");
const html = lee("index.html");
const rn = lee("tests/run.js");

/* ---- 1. la fuente única en config.js ---- */
const mTit = cf.match(/export const TITULO = "([^"]*)";/);
const TITULO = mTit ? mTit[1] : "";
ok(!!TITULO, "config.js exporta TITULO", TITULO || "(no está)");
ok(
  (cf.match(/export const TITULO\b/g) || []).length === 1,
  "TITULO se declara una sola vez",
  String((cf.match(/export const TITULO\b/g) || []).length),
);
ok(
  TITULO === "SSJ Barber | Barbería en Puerto Iguazú",
  "TITULO es el texto que pidió el dueño (con tilde)",
  JSON.stringify(TITULO),
);
ok(!!cf.match(/export const NOMBRE = "SSJ Barber";/), "NOMBRE sigue siendo la marca pelada");

/* ---- 2. index.html dice exactamente lo mismo ---- */
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
const og = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || "";
const tw = (html.match(/<meta name="twitter:title" content="([^"]*)"/) || [])[1] || "";
ok(title === TITULO, "<title> === TITULO de config.js", JSON.stringify(title));
ok(og === TITULO, "og:title === TITULO (lo que se ve al compartir)", JSON.stringify(og));
ok(tw === TITULO, "twitter:title === TITULO", JSON.stringify(tw));

/* ---- 3. la app deja de pisarlo con el nombre pelado ---- */
ok(
  /document\.title = TITULO;/.test(mj),
  "main.js: R() asigna document.title = TITULO",
);
ok(
  !/document\.title = NOMBRE/.test(mj),
  "main.js: ya no queda document.title = NOMBRE",
);
ok(
  /^ {2}TITULO,$/m.test(mj) || /\bTITULO,\n/.test(mj),
  "main.js importa TITULO de config.js",
);
ok(
  (mj.match(/document\.title = /g) || []).length === 1,
  "un solo lugar asigna document.title",
  String((mj.match(/document\.title = /g) || []).length),
);

/* ---- 4. la marca no se toca ---- */
const jl = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
ok(!!jl, "hay JSON-LD");
if (jl) {
  let j = null;
  try {
    j = JSON.parse(jl[1]);
  } catch (e) {
    /* el fallo lo reporta el ok de abajo */
  }
  ok(!!j, "el JSON-LD parsea");
  ok(j && j.name === "SSJ Barber", "el JSON-LD sigue con name: SSJ Barber (sin tilde)", j && j.name);
}
const man = lee("manifest.json");
ok(/"short_name":\s*"SSJ Barber"/.test(man), "el manifest sigue con short_name: SSJ Barber");
ok(!/SSJ Bárber/i.test(html), "la marca no lleva tilde en ninguna parte del HTML");

/* ---- 5. sigue siendo un título sano para Google ---- */
ok(TITULO.length >= 25 && TITULO.length <= 65, "el título tiene largo de SEO (25-65)", `${TITULO.length}`);
ok(TITULO.length <= 60, "y además entra sin recortar en el corte clásico de Google (<=60)", `${TITULO.length}`);
ok(TITULO.indexOf("SSJ Barber") === 0, "el título arranca con la marca", TITULO);
ok(/Barbería/.test(TITULO), "el título dice Barbería", TITULO);
ok(/Puerto Iguazú/.test(TITULO), "el título nombra la ciudad con tilde", TITULO);
ok(!/✅/.test(title), "no hay check ni emoji pegado en el título (era caché de Google)");

/* ---- 6. la fila de la suite ---- */
ok(/n:\s*"lote51"/.test(rn), "run.js tiene la fila lote51");

console.log(`\n${process.exitCode ? "HAY FALLAS" : "TODO VERDE"} — ${okn} checks`);
