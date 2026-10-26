/* Lote 52: la foto que Google enseña (cache-bust del logo).

   El dueño reportó: Google mostraba el título nuevo pero la foto vieja
   ("CODIGO Barber"). Causa: el lote 37 reemplazó los bytes de
   assets/logo-256.png SIN cambiar la URL, y el resultado de Google es un
   favicon/miniatura que Google cachea POR URL: los bytes que ya tiene de esa
   URL los sigue mostrando aunque el sitio sirva otros. El texto (title) sí se
   refrescó porque se autocompara contra el HTML en cada recrawl; la imagen va
   por su index de imágenes propio y aparte.

   Arreglo: ?v=2 en las cuatro URLs del logo que leen los rastreadores:
     1. og:image      (Google, WhatsApp, Discord)
     2. twitter:image (X)
     3. JSON-LD "image" (tarjeta de negocio de Google)
     4. JSON-LD "logo"  (ídem)
   URL nueva = Google tiene que pedirla de nuevo = baja los bytes del logo
   SSJ Barber que ya se sirven. El archivo NO cambia ni se duplica: el
   servidor estático ignora el query, así que logo-256.png?v=2 es el mismo
   archivo. Cuando se vuelva a cambiar el logo, se sube a v=3 EN LAS CUATRO.

   Lo que NO se toca a propósito: los <link rel="icon"> / apple-touch-icon
   (seo2.js los pide exactos) y LOGO de config.js (lo pega el propio DOM, no
   los rastreadores; el navegador baja la foto fresca por la red).
   favicon.ico de la raíz sigue generándose de logo-256.png por tests/favicon.js.

   Uso:  node tests\lote52.js
   En run.js: fila 'lote52' (después de 'lote51'). */
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

const RUTA = "assets/logo-256.png";
const URL_V = "https://codigobarber.com.ar/" + RUTA + "?v=2";

const html = lee("index.html");
const sj = lee("tests/seo.js");
const rn = lee("tests/run.js");

/* ---- 1. el archivo sigue existiendo (se versiona la URL, no se mueve) ---- */
ok(fs.existsSync(path.join(__dirname, "..", RUTA)), RUTA + " sigue en el repo");

/* ---- 2. las cuatro URLs del head llevan la versión ---- */
const ogImg = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || "";
const twImg = (html.match(/<meta name="twitter:image" content="([^"]*)"/) || [])[1] || "";
ok(ogImg === URL_V, "og:image lleva la versión", ogImg || "(no está)");
ok(twImg === URL_V, "twitter:image lleva la versión", twImg || "(no está)");

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
  const img = j && Array.isArray(j.image) ? String(j.image[0] || "") : "";
  const logo = j && typeof j.logo === "string" ? j.logo : "";
  ok(img === URL_V, 'JSON-LD "image" lleva la versión', img || "(no está)");
  ok(logo === URL_V, 'JSON-LD "logo" lleva la versión', logo || "(no está)");
}

/* ---- 3. en el head no queda ninguna referencia al logo sin versionar ---- */
/* Se sacan los comentarios del HTML (allí se menciona el archivo en texto),
   se limita al <head> (el <img> del splash del loader NO se versiona: es el
   propio logo en pantalla, no algo que lee un rastreador), se borra toda
   aparición de logo-256.png?v=N y lo que sobra (og:image / twitter:image /
   JSON-LD) no debe seguir diciendo logo-256.png pelado. */
const cuerpo = html.replace(/<!--[\s\S]*?-->/g, "");
const head = cuerpo.slice(0, cuerpo.search(/<\/head>/i));
const sinVersion = head.replace(/logo-256\.png\?v=\d+/g, "VERSIONADA");
ok(!/logo-256\.png/.test(sinVersion), "ninguna URL del logo quedó pelada en el head (sin ?v=)");
ok(/cache-bust \(lote 52\)/.test(html), "el index.html explica el ?v=2 en un comentario");

/* ---- 4. favicon ico/links intactos (seo2.js los pide exactos) ---- */
const existe = (f) => fs.existsSync(path.join(__dirname, "..", f));
for (const f of ["favicon.ico", "assets/icon-192.png", "assets/icon-512.png", "assets/apple-touch-icon.png"]) {
  ok(existe(f), "sigue existiendo " + f);
}
ok(
  !!html.match(/<link rel="icon" type="image\/png" href="assets\/icon-192\.png"/),
  "el link del icon sigue sin query",
);

/* ---- 5. la prueba general de seo.js cuida la versión ---- */
ok(sj.includes("logo-256\\.png\\?v=2$") || /logo-256\\\.png\\\?v=2\$/.test(sj), "tests/seo.js aserta la URL versionada");

/* ---- 6. la fila de la suite ---- */
ok(/n:\s*"lote52"/.test(rn), "run.js tiene la fila lote52");

console.log(`\n${process.exitCode ? "HAY FALLAS" : "TODO VERDE"} — ${okn} checks`);
